<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\Task;
use App\Models\House;
use Illuminate\Support\Str;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;

class AiAssistentController extends Controller
{
    public function state(Request $request)
    {
        $user = $request->user();
        $today = now()->toDateString();

        $houses = $user->houses()
            ->with(['members:id,name,nickname,email,avatar'])
            ->withCount([
                'members',
                'tasks as pending_tasks_count' => fn($q) => $q->whereNull('completed_at')
            ])
            ->get();

        $houseIds = $houses->pluck('id');
        $housesById = $houses->keyBy('id');

        $tasks = Task::with([
                'house:id,name,context_type,icon',
                'doingUser:id,name,nickname',
                'assignee:id,name,nickname',
                'mentionedUsers:id,name,nickname'
            ])
            ->whereIn('house_id', $houseIds)
            ->get()
            ->each(function ($task) use ($housesById) {
                if ($task->house && isset($housesById[$task->house_id])) {
                    $task->house->members_count = $housesById[$task->house_id]->members_count;
                }
            });

        $briefing = DB::table('daily_briefings')
            ->where('user_id', $user->id)
            ->where('reference_date', $today)
            ->first();

        if ($briefing) {
            $briefing->calendar_events = is_string($briefing->calendar_events) ? json_decode($briefing->calendar_events, true) : $briefing->calendar_events;
            $briefing->pending_bills   = is_string($briefing->pending_bills) ? json_decode($briefing->pending_bills, true) : $briefing->pending_bills;
            $briefing->emails_summary  = is_string($briefing->emails_summary) ? json_decode($briefing->emails_summary, true) : $briefing->emails_summary;
        }

        $activeItems = $tasks->whereNull('completed_at');

        return response()->json([
            'timestamp'     => now()->toIso8601String(),
            'spaces'        => $houses,
            'all_tasks'     => $tasks->values(),
            'briefing'      => $briefing,
            'in_progress'   => $activeItems->whereNotNull('in_progress_by')->values(),
            'pending_tasks' => $activeItems->whereIn('type', ['task', 'priority'])->values(),
            'lists'         => $activeItems->where('type', 'list')->values(),
            'notes'         => $activeItems->where('type', 'note')->values(),
        ]);
    }

    public function action(Request $request)
    {
        $validated = $request->validate([
            'action'             => 'required|in:create,update,complete,uncomplete,start_progress,stop_progress,mark_notified,delete,create_space,update_space,join_space,reorder_spaces',
            'task_id'            => 'nullable|integer|exists:tasks,id',
            'house_id'           => 'nullable|integer|exists:houses,id',
            'context_type'       => 'nullable|string',
            'title'              => 'nullable|string|max:500',
            'description'        => 'nullable|string',
            'type'               => 'nullable|in:task,list,note',
            'priority'           => 'nullable|in:low,medium,high',
            'recurrence'         => 'nullable|string|max:100',
            'due_date'           => 'nullable|date',
            'assigned_to'        => 'nullable|integer|exists:users,id',
            'assigned_to_ids'    => 'nullable|array',
            'assigned_to_ids.*'  => 'integer|exists:users,id',
            'checklist'          => 'nullable|array',
            'is_numbered'        => 'nullable|boolean',
            'mentioned_user_ids' => 'nullable|array',
            'notify_members'     => 'nullable|boolean',
            'notify_at'          => 'nullable|date',
            'completion_note'    => 'nullable|string',
            'name'               => 'nullable|string|max:255',
            'icon'               => 'nullable|string|max:32',
            'member_ids'         => 'nullable|array',
            'space_ids'          => 'nullable|array',
            'invite_code'        => 'nullable|string|max:20',
            'notify_entry'       => 'nullable|boolean',
        ]);

        $user = $request->user();

        // REORDENAR ESPAÇOS DO USUÁRIO (Drag & Drop)
        if ($validated['action'] === 'reorder_spaces') {
            $spaceIds = $validated['space_ids'] ?? [];
            foreach ($spaceIds as $index => $spaceId) {
                DB::table('house_user')
                    ->where('user_id', $user->id)
                    ->where('house_id', (int) $spaceId)
                    ->update(['position' => $index]);
            }

            return response()->json(['status' => 'spaces_reordered']);
        }

        // ATUALIZAR ESPAÇO EXISTENTE
        if ($validated['action'] === 'update_space') {
            $house = House::with('members:id')->findOrFail($validated['house_id']);
            $house->name = $validated['name'] ?? $house->name;
            $house->description = array_key_exists('description', $validated) ? $validated['description'] : $house->description;
            if (!empty($validated['icon'])) {
                $house->icon = $validated['icon'];
            }
            $house->save();

            if (array_key_exists('member_ids', $validated) && is_array($validated['member_ids'])) {
                $currentMemberIds = $house->members->pluck('id')->map(fn($id) => (int) $id)->toArray();
                $desiredIds = array_unique(array_map('intval', $validated['member_ids']));

                $keepSync = [$user->id => ['role' => 'owner']];
                foreach ($desiredIds as $mId) {
                    if ($mId === (int) $user->id) continue;
                    if (in_array($mId, $currentMemberIds, true)) {
                        $keepSync[$mId] = ['role' => 'resident'];
                    } else {
                        DB::table('space_invitations')->updateOrInsert(
                            ['house_id' => $house->id, 'invitee_id' => $mId],
                            ['inviter_id' => $user->id, 'status' => 'pending', 'created_at' => now(), 'updated_at' => now()]
                        );
                        $this->sendUserNotification(
                            $mId,
                            $house->name,
                            "{$user->name} convidou você para participar do espaço \"{$house->name}\".",
                            '/friends'
                        );
                    }
                }
                $house->members()->sync($keepSync);
            }

            return response()->json([
                'status' => 'space_updated',
                'house'  => $house->load('members:id,name,nickname,email,avatar'),
            ]);
        }

        // CRIAR NOVO ESPAÇO
        if ($validated['action'] === 'create_space') {
            $nextPos = ((int) DB::table('house_user')->where('user_id', $user->id)->max('position')) + 1;

            $house = new House();
            $house->name = $validated['name'];
            $house->description = $validated['description'] ?? null;
            $house->icon = $validated['icon'] ?? 'folder';
            $house->invite_code = strtoupper(Str::random(8));
            $house->save();

            $house->members()->attach($user->id, ['role' => 'owner', 'position' => $nextPos]);

            if (!empty($validated['member_ids'])) {
                $friendIds = array_unique(array_diff($validated['member_ids'], [$user->id]));
                foreach ($friendIds as $friendId) {
                    DB::table('space_invitations')->updateOrInsert(
                        ['house_id' => $house->id, 'invitee_id' => (int) $friendId],
                        ['inviter_id' => $user->id, 'status' => 'pending', 'created_at' => now(), 'updated_at' => now()]
                    );

                    $this->sendUserNotification(
                        (int) $friendId,
                        $house->name,
                        "{$user->name} convidou você para participar do espaço \"{$house->name}\".",
                        '/friends'
                    );
                }
            }

            return response()->json(['status' => 'space_created', 'house' => $house], 201);
        }

        // ENTRAR EM ESPAÇO COM CÓDIGO
        if ($validated['action'] === 'join_space') {
            $code = strtoupper(trim($validated['invite_code'] ?? ''));
            $house = House::with('members:id,name')->where('invite_code', $code)->first();

            if (!$house) {
                return response()->json(['message' => 'Código de espaço inválido.'], 404);
            }

            if (!$house->members->contains('id', $user->id)) {
                $nextPos = ((int) DB::table('house_user')->where('user_id', $user->id)->max('position')) + 1;
                $house->members()->attach($user->id, ['role' => 'resident', 'position' => $nextPos]);

                if (!empty($validated['notify_entry'])) {
                    foreach ($house->members as $member) {
                        if ($member->id === $user->id) continue;
                        $this->sendUserNotification(
                            $member->id,
                            $house->name,
                            "{$user->name} entrou no espaço \"{$house->name}\".",
                            "/houses/{$house->id}"
                        );
                    }
                }
            }

            return response()->json(['status' => 'space_joined', 'house' => $house]);
        }

        // CRIAR ITEM (TAREFA / LISTA / NOTA) COM MÚLTIPLOS RESPONSÁVEIS
        if ($validated['action'] === 'create') {
            $houseId = $validated['house_id'] ?? $user->houses()
                ->when($validated['context_type'] ?? null, fn($q, $ctx) => $q->where('context_type', $ctx))
                ->value('houses.id');

            $assigneeIds = [];
            if (array_key_exists('assigned_to_ids', $validated)) {
                $assigneeIds = array_values(array_unique(array_map('intval', $validated['assigned_to_ids'] ?? [])));
            } elseif (!empty($validated['assigned_to'])) {
                $assigneeIds = [(int) $validated['assigned_to']];
            }

            $task = Task::create([
                'house_id'    => $houseId,
                'created_by'  => $user->id,
                'assigned_to' => $assigneeIds[0] ?? null,
                'title'       => $validated['title'],
                'description' => $validated['description'] ?? null,
                'type'        => $validated['type'] ?? 'task',
                'priority'    => $validated['priority'] ?? 'medium',
                'recurrence'  => $validated['recurrence'] ?? 'none',
                'due_date'    => $validated['due_date'] ?? null,
                'checklist'   => $validated['checklist'] ?? [],
                'is_numbered' => $validated['is_numbered'] ?? false,
                'notify_at'   => $validated['notify_at'] ?? null,
            ]);

            if (!empty($assigneeIds)) {
                $task->assignees()->sync($assigneeIds);
            }

            $houseName = House::where('id', $houseId)->value('name') ?? 'Espaço';
            $notifiedUsers = [];

            if (!empty($validated['mentioned_user_ids']) && method_exists($task, 'mentionedUsers')) {
                $task->mentionedUsers()->sync($validated['mentioned_user_ids']);
                foreach ($validated['mentioned_user_ids'] as $mentionedId) {
                    if ((int) $mentionedId === (int) $user->id) continue;
                    $this->sendUserNotification(
                        (int) $mentionedId,
                        $houseName,
                        "{$user->name} mencionou você na tarefa: \"{$task->title}\"",
                        "/houses/{$houseId}"
                    );
                    $notifiedUsers[] = (int) $mentionedId;
                }
            }

            foreach ($assigneeIds as $assignedId) {
                if ($assignedId === (int) $user->id || in_array($assignedId, $notifiedUsers, true)) continue;
                $this->sendUserNotification(
                    $assignedId,
                    $houseName,
                    "{$user->name} atribuiu uma tarefa para você: \"{$task->title}\"",
                    "/houses/{$houseId}"
                );
                $notifiedUsers[] = $assignedId;
            }

            if (!empty($validated['notify_members'])) {
                $this->notifySpaceMembers($task, $user, 'criou');
            }

            return response()->json([
                'status' => 'created',
                'task'   => $task->load(['house:id,name,context_type,icon', 'assignee:id,name,nickname', 'assignees:id,name,nickname', 'mentionedUsers:id,name,nickname']),
            ], 201);
        }

        $task = Task::findOrFail($validated['task_id']);

        // ATUALIZAR ITEM (BLOQUEADO SE JÁ CONCLUÍDO)
        if ($validated['action'] === 'update') {
            abort_if($task->completed_at !== null, 422, 'Tarefas concluídas não podem ser editadas. Reabra a tarefa primeiro.');

            $previousAssigneeIds = $task->assignees()->pluck('users.id')->map(fn($id) => (int) $id)->toArray();

            $updateData = [
                'house_id'    => $validated['house_id'] ?? $task->house_id,
                'title'       => $validated['title'] ?? $task->title,
                'description' => array_key_exists('description', $validated) ? $validated['description'] : $task->description,
                'type'        => $validated['type'] ?? $task->type,
                'priority'    => $validated['priority'] ?? $task->priority,
                'recurrence'  => $validated['recurrence'] ?? $task->recurrence,
                'due_date'    => array_key_exists('due_date', $validated) ? $validated['due_date'] : $task->due_date,
                'checklist'   => array_key_exists('checklist', $validated) ? ($validated['checklist'] ?? []) : $task->checklist,
                'is_numbered' => array_key_exists('is_numbered', $validated) ? (bool) $validated['is_numbered'] : $task->is_numbered,
            ];

            $newAssigneeIds = null;
            if (array_key_exists('assigned_to_ids', $validated)) {
                $newAssigneeIds = array_values(array_unique(array_map('intval', $validated['assigned_to_ids'] ?? [])));
                $updateData['assigned_to'] = $newAssigneeIds[0] ?? null;
            } elseif (array_key_exists('assigned_to', $validated)) {
                $newAssigneeIds = !empty($validated['assigned_to']) ? [(int) $validated['assigned_to']] : [];
                $updateData['assigned_to'] = $validated['assigned_to'];
            }

            $task->update($updateData);

            $houseName = House::where('id', $task->house_id)->value('name') ?? 'Espaço';

            if (array_key_exists('mentioned_user_ids', $validated) && method_exists($task, 'mentionedUsers')) {
                $newMentions = $validated['mentioned_user_ids'] ?? [];
                $task->mentionedUsers()->sync($newMentions);
                foreach ($newMentions as $mentionedId) {
                    if ((int) $mentionedId === (int) $user->id) continue;
                    $this->sendUserNotification(
                        (int) $mentionedId,
                        $houseName,
                        "{$user->name} mencionou você em: \"{$task->title}\"",
                        "/houses/{$task->house_id}"
                    );
                }
            }

            if ($newAssigneeIds !== null) {
                $task->assignees()->sync($newAssigneeIds);
                $addedAssignees = array_diff($newAssigneeIds, $previousAssigneeIds);
                foreach ($addedAssignees as $assignedId) {
                    if ($assignedId === (int) $user->id) continue;
                    $this->sendUserNotification(
                        $assignedId,
                        $houseName,
                        "{$user->name} atribuiu a tarefa \"{$task->title}\" para você.",
                        "/houses/{$task->house_id}"
                    );
                }
            }

            if (!empty($validated['notify_members'])) {
                $this->notifySpaceMembers($task, $user, 'atualizou');
            }

            return response()->json([
                'status' => 'updated',
                'task'   => $task->load(['house:id,name,context_type,icon', 'assignee:id,name,nickname', 'assignees:id,name,nickname', 'mentionedUsers:id,name,nickname']),
            ]);
        }

        if ($validated['action'] === 'delete') {
            $task->delete();
            return response()->json(['status' => 'deleted']);
        }

        // CONCLUIR TAREFA (Registra quem clicou em completed_by)
        if ($validated['action'] === 'complete') {
            $task->update([
                'is_completed'    => true,
                'completed_at'    => now(),
                'completed_by'    => $user->id,
                'in_progress_by'  => null,
                'completion_note' => $validated['completion_note'] ?? $task->completion_note,
            ]);

            if ($task->type === 'task' && !empty($task->recurrence) && $task->recurrence !== 'none') {
                $nextDueDate = $this->calculateNextDueDate($task->due_date, $task->recurrence);

                $resetChecklist = collect($task->checklist ?? [])->map(function ($step) {
                    if (is_array($step)) {
                        $step['done'] = false;
                    }
                    return $step;
                })->toArray();

                $nextTask = Task::create([
                    'house_id'    => $task->house_id,
                    'created_by'  => $task->created_by,
                    'assigned_to' => $task->assigned_to,
                    'title'       => $task->title,
                    'description' => $task->description,
                    'type'        => 'task',
                    'priority'    => $task->priority,
                    'recurrence'  => $task->recurrence,
                    'due_date'    => $nextDueDate,
                    'checklist'   => $resetChecklist,
                    'is_numbered' => $task->is_numbered,
                ]);

                $assigneeIds = $task->assignees()->pluck('users.id')->toArray();
                if (!empty($assigneeIds)) {
                    $nextTask->assignees()->sync($assigneeIds);
                }

                if (method_exists($task, 'mentionedUsers')) {
                    $mentionIds = $task->mentionedUsers()->pluck('users.id')->toArray();
                    if (!empty($mentionIds)) {
                        $nextTask->mentionedUsers()->sync($mentionIds);
                    }
                }
            }
        } elseif ($validated['action'] === 'uncomplete') {
            // DESCONCLUIR / REABRIR TAREFA
            $task->update([
                'is_completed'    => false,
                'completed_at'    => null,
                'completed_by'    => null,
                'completion_note' => null,
            ]);
        } elseif ($validated['action'] === 'start_progress') {
            $task->update(['in_progress_by' => $user->id]);
        } elseif ($validated['action'] === 'stop_progress') {
            $task->update(['in_progress_by' => null]);
        } elseif ($validated['action'] === 'mark_notified') {
            $task->update(['notified' => true]);
        }

        return response()->json(['status' => 'updated', 'task' => $task->fresh()]);
    }

    private function calculateNextDueDate($currentDueDate, string $recurrence): \Carbon\Carbon
    {
        $base = $currentDueDate ? \Carbon\Carbon::parse($currentDueDate) : now();
        if ($base->isPast()) {
            $base = now();
        }

        if ($recurrence === 'daily') return $base->addDay();
        if ($recurrence === 'weekdays') return $base->addWeekday();
        if ($recurrence === 'weekly') return $base->addWeek();
        if ($recurrence === 'biweekly') return $base->addWeeks(2);
        if ($recurrence === 'monthly') return $base->addMonth();
        if ($recurrence === 'yearly') return $base->addYear();

        if (str_starts_with($recurrence, 'custom:')) {
            $parts = explode(':', $recurrence);
            $interval = max(1, (int) ($parts[1] ?? 1));
            $unit = $parts[2] ?? 'days';
            if ($unit === 'weeks') return $base->addWeeks($interval);
            if ($unit === 'months') return $base->addMonths($interval);
            return $base->addDays($interval);
        }

        return $base->addDay();
    }

    public function voice(Request $request)
    {
        $validated = $request->validate([
            'text' => 'required|string|max:1000',
        ]);

        $user = $request->user();
        $rawText = trim($validated['text']);
        $lower = mb_strtolower($rawText, 'UTF-8');

        $contextType = 'personal';
        if (preg_match('/\b(sev|ag[eê]ncia|cliente|landing|marketing|proposta)\b/u', $lower)) {
            $contextType = 'agency';
        } elseif (preg_match('/\b(uva|faculdade|aula|prova|estagio|est[aá]gio|pet|computa[cç][aã]o)\b/u', $lower)) {
            $contextType = 'college';
        } elseif (preg_match('/\b(amanda|casal|casa|mercado|comprar)\b/u', $lower)) {
            $contextType = 'couple';
        }

        $type = 'task';
        $priority = 'medium';
        if (preg_match('/\b(prioridade|urgente|importante|foco)\b/u', $lower)) {
            $priority = 'high';
        } elseif (preg_match('/\b(nota|anote|anotar|lembrete|ideia)\b/u', $lower)) {
            $type = 'note';
        }

        $cleanTitle = preg_replace('/^(jarvis|sistema)?[\s,]*(me lembre de|anote|anotar|criar|crie|adicionar|adicione)?[\s,]*(uma|um)?[\s,]*(prioridade|tarefa|nota)?[\s,:(para|de|na|no)]*/iu', '', $rawText);
        $cleanTitle = ucfirst(trim($cleanTitle) ?: $rawText);

        $house = $user->houses()->where('context_type', $contextType)->first()
            ?? $user->houses()->first();

        $task = Task::create([
            'house_id'    => $house->id,
            'created_by'  => $user->id,
            'assigned_to' => $user->id,
            'title'       => $cleanTitle,
            'type'        => $type,
            'priority'    => $priority,
        ]);

        return response()->json([
            'status' => 'created',
            'reply'  => "Registrado em {$house->name}.",
            'task'   => $task->load('house:id,name,context_type,icon'),
        ], 201);
    }

    public function webhookGoogle(Request $request)
    {
        abort_if($request->header('X-Jarvis-Secret') !== env('JARVIS_WEBHOOK_SECRET'), 403, 'Unauthorized');

        $validated = $request->validate([
            'user_id'         => 'required|exists:users,id',
            'calendar_events' => 'nullable|array',
            'pending_bills'   => 'nullable|array',
            'emails_summary'  => 'nullable|array',
            'spoken_summary'  => 'nullable|string',
        ]);

        DB::table('daily_briefings')->updateOrInsert(
            ['user_id' => $validated['user_id'], 'reference_date' => now()->toDateString()],
            [
                'calendar_events' => json_encode($validated['calendar_events'] ?? []),
                'pending_bills'   => json_encode($validated['pending_bills'] ?? []),
                'emails_summary'  => json_encode($validated['emails_summary'] ?? []),
                'spoken_summary'  => $validated['spoken_summary'] ?? null,
                'updated_at'      => now(),
            ]
        );

        return response()->json(['status' => 'briefing_saved']);
    }

    public function registerUser(Request $request)
    {
        $validated = $request->validate([
            'name'        => 'required|string|max:255',
            'nickname'    => 'required|string|max:60',
            'phone'       => 'required|string|max:30',
            'email'       => 'required|email|unique:users,email',
            'password'    => 'required|string|min:6|confirmed',
            'theme_color' => 'nullable|string|max:20',
        ]);

        $user = User::create([
            'name'                  => $validated['name'],
            'nickname'              => $validated['nickname'],
            'phone'                 => $validated['phone'],
            'email'                 => $validated['email'],
            'password'              => Hash::make($validated['password']),
            'theme_color'           => $validated['theme_color'] ?? 'orange',
            'notifications_enabled' => true,
        ]);

        $house = new House();
        $house->name = 'Pessoal';
        $house->description = 'Meu espaço individual';
        $house->icon = 'user';
        $house->invite_code = strtoupper(Str::random(8));
        $house->save();
        $house->members()->attach($user->id, ['role' => 'owner']);

        $token = $user->createToken('pwa_token')->plainTextToken;

        return response()->json([
            'token' => $token,
            'user'  => $user,
        ], 201);
    }

    public function updateProfile(Request $request)
    {
        $user = $request->user();

        $validated = $request->validate([
            'name'                  => 'sometimes|required|string|max:255',
            'nickname'              => 'nullable|string|max:60',
            'email'                 => 'sometimes|required|email|unique:users,email,' . $user->id,
            'phone'                 => 'nullable|string|max:30',
            'bio'                   => 'nullable|string|max:500',
            'status_text'           => 'nullable|string|max:100',
            'avatar'                => 'nullable|string',
            'theme_color'           => 'nullable|string|max:20',
            'notifications_enabled' => 'nullable|boolean',
            'password'              => 'nullable|string|min:6|confirmed',
        ]);

        if (!empty($validated['password'])) {
            $validated['password'] = Hash::make($validated['password']);
        } else {
            unset($validated['password']);
        }

        $user->update($validated);

        return response()->json($user->fresh());
    }

    public function socialState(Request $request)
    {
        $user = $request->user();

        $friendships = DB::table('friendships')
            ->where('status', 'accepted')
            ->where(function ($q) use ($user) {
                $q->where('sender_id', $user->id)->orWhere('receiver_id', $user->id);
            })
            ->get();

        $friendIds = $friendships->map(fn($f) => $f->sender_id === $user->id ? $f->receiver_id : $f->sender_id)->unique()->values();
        $friends = User::whereIn('id', $friendIds)
            ->get(['id', 'name', 'nickname', 'email', 'avatar', 'bio', 'status_text']);

        $friendRequests = DB::table('friendships')
            ->join('users', 'users.id', '=', 'friendships.sender_id')
            ->where('friendships.receiver_id', $user->id)
            ->where('friendships.status', 'pending')
            ->select(
                'friendships.id as request_id',
                'users.id as user_id',
                'users.name',
                'users.nickname',
                'users.email',
                'users.avatar',
                'friendships.created_at'
            )
            ->get();

        $spaceInvites = DB::table('space_invitations')
            ->join('houses', 'houses.id', '=', 'space_invitations.house_id')
            ->join('users', 'users.id', '=', 'space_invitations.inviter_id')
            ->where('space_invitations.invitee_id', $user->id)
            ->where('space_invitations.status', 'pending')
            ->select(
                'space_invitations.id as invite_id',
                'houses.id as house_id',
                'houses.name as house_name',
                'houses.icon as house_icon',
                'users.id as inviter_id',
                'users.name as inviter_name',
                'users.nickname as inviter_nickname',
                'space_invitations.created_at'
            )
            ->get();

        $mySpaces = $user->houses()->get(['houses.id', 'houses.name', 'houses.icon']);

        return response()->json([
            'friends'         => $friends,
            'friend_requests' => $friendRequests,
            'space_invites'   => $spaceInvites,
            'my_spaces'       => $mySpaces,
        ]);
    }

    public function searchUsers(Request $request)
    {
        $user = $request->user();
        $q = trim((string) $request->query('q', ''));
        if ($q === '') {
            return response()->json([]);
        }

        $cleanId = ltrim($q, '#');

        $users = User::where('id', '!=', $user->id)
            ->where(function ($query) use ($q, $cleanId) {
                if (is_numeric($cleanId)) {
                    $query->orWhere('id', (int) $cleanId);
                }
                $query->orWhere('name', 'ilike', "%{$q}%")
                      ->orWhere('nickname', 'ilike', "%{$q}%")
                      ->orWhere('email', 'ilike', "%{$q}%");
            })
            ->limit(15)
            ->get(['id', 'name', 'nickname', 'email', 'avatar', 'status_text']);

        $relations = DB::table('friendships')
            ->where(function ($qBuilder) use ($user) {
                $qBuilder->where('sender_id', $user->id)->orWhere('receiver_id', $user->id);
            })
            ->get();

        $results = $users->map(function ($u) use ($relations, $user) {
            $rel = $relations->first(fn($r) =>
                ($r->sender_id === $user->id && $r->receiver_id === $u->id) ||
                ($r->sender_id === $u->id && $r->receiver_id === $user->id)
            );
            $u->friendship_status = $rel ? $rel->status : 'none';
            return $u;
        });

        return response()->json($results);
    }

    public function socialAction(Request $request)
    {
        $validated = $request->validate([
            'action'     => 'required|in:send_friend_request,respond_friend_request,remove_friend,send_space_invite,respond_space_invite',
            'target_id'  => 'nullable|integer',
            'request_id' => 'nullable|integer',
            'house_id'   => 'nullable|integer|exists:houses,id',
            'decision'   => 'nullable|in:accept,decline',
        ]);

        $user = $request->user();

        if ($validated['action'] === 'send_friend_request') {
            $targetId = (int) $validated['target_id'];
            abort_if($targetId === $user->id, 422, 'Operação inválida.');

            DB::table('friendships')->updateOrInsert(
                ['sender_id' => $user->id, 'receiver_id' => $targetId],
                ['status' => 'pending', 'updated_at' => now(), 'created_at' => now()]
            );

            $this->sendUserNotification(
                $targetId,
                'Amizades',
                "{$user->name} (#{$user->id}) enviou um pedido de amizade para você.",
                '/friends'
            );

            return response()->json(['status' => 'friend_request_sent']);
        }

        if ($validated['action'] === 'respond_friend_request') {
            $req = DB::table('friendships')
                ->where('id', $validated['request_id'])
                ->where('receiver_id', $user->id)
                ->first();

            abort_if(!$req, 404);

            if ($validated['decision'] === 'accept') {
                DB::table('friendships')->where('id', $req->id)->update([
                    'status'     => 'accepted',
                    'updated_at' => now(),
                ]);
                $this->sendUserNotification(
                    $req->sender_id,
                    'Amizades',
                    "{$user->name} aceitou seu pedido de amizade!",
                    '/friends'
                );
            } else {
                DB::table('friendships')->where('id', $req->id)->delete();
            }

            return response()->json(['status' => 'friend_request_handled']);
        }

        if ($validated['action'] === 'remove_friend') {
            $targetId = (int) $validated['target_id'];
            DB::table('friendships')
                ->where(function ($q) use ($user, $targetId) {
                    $q->where('sender_id', $user->id)->where('receiver_id', $targetId);
                })
                ->orWhere(function ($q) use ($user, $targetId) {
                    $q->where('sender_id', $targetId)->where('receiver_id', $user->id);
                })
                ->delete();

            return response()->json(['status' => 'friend_removed']);
        }

        if ($validated['action'] === 'send_space_invite') {
            $house = House::findOrFail($validated['house_id']);
            $targetId = (int) $validated['target_id'];

            if (!$house->members()->where('users.id', $targetId)->exists()) {
                DB::table('space_invitations')->updateOrInsert(
                    ['house_id' => $house->id, 'invitee_id' => $targetId],
                    ['inviter_id' => $user->id, 'status' => 'pending', 'updated_at' => now(), 'created_at' => now()]
                );

                $this->sendUserNotification(
                    $targetId,
                    $house->name,
                    "{$user->name} convidou você para participar do espaço \"{$house->name}\".",
                    '/friends'
                );
            }

            return response()->json(['status' => 'space_invite_sent']);
        }

        if ($validated['action'] === 'respond_space_invite') {
            $inv = DB::table('space_invitations')
                ->where('id', $validated['request_id'])
                ->where('invitee_id', $user->id)
                ->first();

            abort_if(!$inv, 404);

            if ($validated['decision'] === 'accept') {
                $house = House::find($inv->house_id);
                if ($house && !$house->members()->where('users.id', $user->id)->exists()) {
                    $house->members()->attach($user->id, ['role' => 'resident']);
                }
                DB::table('space_invitations')->where('id', $inv->id)->delete();
            } else {
                DB::table('space_invitations')->where('id', $inv->id)->delete();
            }

            return response()->json(['status' => 'space_invite_handled']);
        }
    }

    private function notifySpaceMembers(Task $task, $sender, string $verb): void
    {
        $house = House::with('members:id,name')->find($task->house_id);
        if (!$house) return;

        $typeLabel = $task->type === 'list' ? 'a lista' : ($task->type === 'note' ? 'a nota' : 'a tarefa');

        foreach ($house->members as $member) {
            if ($member->id === $sender->id) continue;

            $this->sendUserNotification(
                $member->id,
                $house->name,
                "{$sender->name} {$verb} {$typeLabel}: \"{$task->title}\"",
                "/houses/{$house->id}"
            );
        }
    }

    private function sendUserNotification(int $targetUserId, string $contextName, string $message, string $url): void
    {
        $target = User::find($targetUserId);
        if (!$target || $target->notifications_enabled === false) {
            return;
        }

        DB::table('notifications')->insert([
            'id'              => (string) Str::uuid(),
            'type'            => 'App\\Notifications\\SocialNotification',
            'notifiable_type' => 'App\\Models\\User',
            'notifiable_id'   => $targetUserId,
            'data'            => json_encode([
                'house_name' => $contextName,
                'message'    => $message,
                'url'        => $url,
            ]),
            'created_at'      => now(),
            'updated_at'      => now(),
        ]);
    }
}
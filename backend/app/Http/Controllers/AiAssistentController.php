<?php

namespace App\Http\Controllers;

use App\Models\Task;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AiAssistentController extends Controller
{
    public function state(Request $request)
    {
        $user = $request->user();
        $today = now()->toDateString();

        // Já traz os espaços com membros e contagens para pré-popular Home e HouseDetail em 1 query só
        $houses = $user->houses()
            ->with(['members:id,name,email'])
            ->withCount([
                'members',
                'tasks as pending_tasks_count' => fn($q) => $q->whereNull('completed_at')
            ])
            ->get();

        $houseIds = $houses->pluck('id');

        $tasks = Task::with(['house:id,name,context_type,icon', 'doingUser:id,name', 'assignee:id,name', 'mentionedUsers:id,name'])
            ->whereIn('house_id', $houseIds)
            ->orderByRaw('CASE WHEN in_progress_by IS NOT NULL THEN 0 ELSE 1 END')
            ->orderBy('due_date', 'asc')
            ->get();

        $briefing = DB::table('daily_briefings')
            ->where('user_id', $user->id)
            ->where('reference_date', $today)
            ->first();

        return response()->json([
            'timestamp'     => now()->toIso8601String(),
            'spaces'        => $houses,
            'all_tasks'     => $tasks,
            'briefing'      => $briefing,
            'in_progress'   => $tasks->whereNotNull('in_progress_by')->whereNull('completed_at')->values(),
            'priorities'    => $tasks->where('type', 'priority')->whereNull('completed_at')->values(),
            'pending_tasks' => $tasks->where('type', 'task')->whereNull('completed_at')->values(),
            'notes'         => $tasks->where('type', 'note')->whereNull('completed_at')->take(20)->values(),
        ]);
    }

    public function action(Request $request)
    {
        $validated = $request->validate([
            'action'          => 'required|in:create,complete,start_progress,stop_progress,mark_notified',
            'task_id'         => 'nullable|integer|exists:tasks,id',
            'house_id'        => 'nullable|integer|exists:houses,id',
            'context_type'    => 'nullable|string',
            'title'           => 'nullable|string|max:500',
            'description'     => 'nullable|string',
            'type'            => 'nullable|in:task,priority,note',
            'notify_at'       => 'nullable|date',
            'completion_note' => 'nullable|string',
        ]);

        $user = $request->user();

        if ($validated['action'] === 'create') {
            $houseId = $validated['house_id'] ?? $user->houses()
                ->when($validated['context_type'] ?? null, fn($q, $ctx) => $q->where('context_type', $ctx))
                ->value('houses.id');

            $type = $validated['type'] ?? 'task';

            $task = Task::create([
                'house_id'    => $houseId,
                'created_by'  => $user->id,
                'assigned_to' => $user->id,
                'title'       => $validated['title'],
                'description' => $validated['description'] ?? null,
                'type'        => $type,
                'priority'    => $type === 'priority' ? 'high' : 'medium',
                'notify_at'   => $validated['notify_at'] ?? null,
            ]);

            return response()->json(['status' => 'created', 'task' => $task->load('house:id,name,context_type,icon')], 201);
        }

        $task = Task::findOrFail($validated['task_id']);

        if ($validated['action'] === 'complete') {
            $task->update([
                'is_completed'    => true,
                'completed_at'    => now(),
                'in_progress_by'  => null,
                'completion_note' => $validated['completion_note'] ?? $task->completion_note,
            ]);
        } elseif ($validated['action'] === 'start_progress') {
            $task->update(['in_progress_by' => $user->id]);
        } elseif ($validated['action'] === 'stop_progress') {
            $task->update(['in_progress_by' => null]);
        } elseif ($validated['action'] === 'mark_notified') {
            $task->update(['notified' => true]);
        }

        return response()->json(['status' => 'updated', 'task' => $task]);
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
}
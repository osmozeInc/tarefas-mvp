<?php

namespace App\Http\Controllers;

use App\Enums\TaskPriority;
use App\Models\House;
use App\Models\Task;
use App\Notifications\TaskMentionedNotification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Notification;
use Illuminate\Validation\Rules\Enum;

class TaskController extends Controller
{
    public function index(House $house): JsonResponse
    {
        Gate::authorize('view', $house);

        $tasks = $house->tasks()
            ->with(['assignee:id,name', 'creator:id,name', 'mentionedUsers:id,name'])
            ->orderByRaw('completed_at IS NOT NULL')
            ->orderByRaw('due_date IS NULL, due_date ASC')
            ->latest()
            ->get();

        return response()->json($tasks);
    }

    public function store(Request $request, House $house): JsonResponse
    {
        Gate::authorize('interact', $house);

        $data = $request->validate([
            'title' => 'required|string|max:160',
            'description' => 'nullable|string',
            'assigned_to' => 'nullable|exists:users,id',
            'priority' => ['required', new Enum(TaskPriority::class)],
            'recurrence' => 'sometimes|in:none,daily,weekly,monthly',
            'due_date' => 'nullable|date',
            'mentioned_user_ids' => 'nullable|array',
            'mentioned_user_ids.*' => 'exists:users,id',
        ]);

        $task = $house->tasks()->create([
            ...$data,
            'recurrence' => $data['recurrence'] ?? 'none',
            'created_by' => $request->user()->id,
        ]);

        if (! empty($data['mentioned_user_ids'])) {
            $validMemberIds = $house->members()
                ->whereIn('users.id', $data['mentioned_user_ids'])
                ->pluck('users.id')
                ->toArray();

            $task->mentionedUsers()->sync($validMemberIds);

            $usersToNotify = $house->members()->whereIn('users.id', $validMemberIds)->get();
            Notification::send($usersToNotify, new TaskMentionedNotification($task->load('house'), $request->user()->name));
        }

        return response()->json($task->load(['assignee:id,name', 'mentionedUsers:id,name']), 201);
    }

    public function update(Request $request, House $house, Task $task): JsonResponse
    {
        Gate::authorize('interact', $house);

        $data = $request->validate([
            'title' => 'sometimes|required|string|max:160',
            'description' => 'nullable|string',
            'assigned_to' => 'nullable|exists:users,id',
            'priority' => ['sometimes', new Enum(TaskPriority::class)],
            'recurrence' => 'sometimes|in:none,daily,weekly,monthly',
            'due_date' => 'nullable|date',
            'mentioned_user_ids' => 'nullable|array',
            'mentioned_user_ids.*' => 'exists:users,id',
        ]);

        $task->update($data);

        if (array_key_exists('mentioned_user_ids', $data)) {
            $validMemberIds = $house->members()
                ->whereIn('users.id', $data['mentioned_user_ids'] ?? [])
                ->pluck('users.id')
                ->toArray();

            $previousIds = $task->mentionedUsers()->pluck('users.id')->toArray();
            $newIds = array_diff($validMemberIds, $previousIds);

            $task->mentionedUsers()->sync($validMemberIds);

            if (! empty($newIds)) {
                $usersToNotify = $house->members()->whereIn('users.id', $newIds)->get();
                Notification::send($usersToNotify, new TaskMentionedNotification($task->load('house'), $request->user()->name));
            }
        }

        return response()->json($task->load(['assignee:id,name', 'mentionedUsers:id,name']));
    }

    public function toggleComplete(Request $request, House $house, Task $task): JsonResponse
    {
        Gate::authorize('interact', $house);

        $isCompleting = is_null($task->completed_at);

        $task->update([
            'completed_at' => $isCompleting ? now() : null,
            'assigned_to' => $task->assigned_to ?? ($isCompleting ? $request->user()->id : null),
        ]);

        // Se a tarefa foi concluída e possui recorrência, agenda a próxima automaticamente
        if ($isCompleting && $task->recurrence !== 'none') {
            $baseDate = $task->due_date ? $task->due_date->copy() : now();
            $nextDueDate = match ($task->recurrence) {
                'daily' => $baseDate->addDay(),
                'weekly' => $baseDate->addWeek(),
                'monthly' => $baseDate->addMonth(),
                default => null,
            };

            $nextTask = $house->tasks()->create([
                'created_by' => $task->created_by,
                'assigned_to' => $task->assigned_to,
                'title' => $task->title,
                'description' => $task->description,
                'priority' => $task->priority,
                'recurrence' => $task->recurrence,
                'due_date' => $nextDueDate,
            ]);

            $nextTask->mentionedUsers()->sync($task->mentionedUsers()->pluck('users.id'));
        }

        return response()->json($task);
    }

    public function destroy(House $house, Task $task): JsonResponse
    {
        Gate::authorize('interact', $house);
        $task->delete();

        return response()->json(['message' => 'Tarefa removida.']);
    }

    public function completedHistory(Request $request): JsonResponse
    {
        $houseIds = $request->user()->houses()->pluck('houses.id');

        $tasks = Task::with(['house:id,name', 'assignee:id,name'])
            ->whereIn('house_id', $houseIds)
            ->whereNotNull('completed_at')
            ->orderByDesc('completed_at')
            ->limit(50)
            ->get();

        return response()->json($tasks);
    }
}
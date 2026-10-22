<?php

namespace App\Notifications;

use App\Models\Task;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;
use NotificationChannels\WebPush\WebPushChannel;
use NotificationChannels\WebPush\WebPushMessage;

class TaskMentionedNotification extends Notification
{
    use Queueable;

    public function __construct(public Task $task, public string $mentionedBy) {}

    public function via(object $notifiable): array
    {
        return ['database', WebPushChannel::class];
    }

    public function toWebPush(object $notifiable, object $notification): WebPushMessage
    {
        return (new WebPushMessage)
            ->title("Menção em: {$this->task->house->name}")
            ->body("{$this->mentionedBy} mencionou você na tarefa '{$this->task->title}'.")
            ->action('Ver tarefa', 'view_task')
            ->data([
                'house_id' => $this->task->house_id,
                'task_id' => $this->task->id,
                'url' => "/houses/{$this->task->house_id}",
            ]);
    }

    public function toArray(object $notifiable): array
    {
        return [
            'house_id' => $this->task->house_id,
            'house_name' => $this->task->house->name,
            'task_id' => $this->task->id,
            'task_title' => $this->task->title,
            'mentioned_by' => $this->mentionedBy,
            'message' => "{$this->mentionedBy} mencionou você na tarefa '{$this->task->title}'.",
        ];
    }
}
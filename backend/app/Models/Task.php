<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Task extends Model
{
    protected $fillable = [
        'house_id',
        'created_by',
        'assigned_to',
        'title',
        'description',
        'priority',
        'recurrence',
        'due_date',
        'completed_at',
        'type', // task, list, note
        'checklist',
        'is_numbered',
        'is_completed',
        'in_progress_by',
        'completion_note',
        'notify_at',
        'notified',
        'points',
    ];

    protected function casts(): array
    {
        return [
            'checklist'    => 'array',
            'is_numbered'  => 'boolean',
            'is_completed' => 'boolean',
            'notified'     => 'boolean',
            'due_date'     => 'datetime',
            'completed_at' => 'datetime',
            'notify_at'    => 'datetime',
        ];
    }

    public function house(): BelongsTo
    {
        return $this->belongsTo(House::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function assignee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }

    public function doingUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'in_progress_by');
    }

    public function mentionedUsers(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'task_mentions')->withTimestamps();
    }
}
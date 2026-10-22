<?php

namespace App\Models;

use App\Enums\HouseRole;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

class House extends Model
{
    protected $fillable = [
        'name',
        'description',
        'invite_code',
    ];

    protected static function booted(): void
    {
        static::creating(function (House $house) {
            if (empty($house->invite_code)) {
                $house->invite_code = Str::upper(Str::random(8));
            }
        });
    }

    public function members(): BelongsToMany
    {
        return $this->belongsToMany(User::class)
            ->withPivot('role')
            ->withTimestamps();
    }

    public function tasks(): HasMany
    {
        return $this->hasMany(Task::class);
    }

    public function messages(): HasMany
    {
        return $this->hasMany(Message::class);
    }

    public function getUserRole(User $user): ?HouseRole
    {
        $member = $this->members()->where('user_id', $user->id)->first();
        return $member ? HouseRole::tryFrom($member->pivot->role) : null;
    }
}
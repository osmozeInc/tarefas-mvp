<?php

namespace App\Http\Controllers;

use App\Enums\HouseRole;
use App\Models\House;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rules\Enum;

class HouseController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $houses = $request->user()
            ->houses()
            ->withCount([
                'members',
                'tasks as pending_tasks_count' => fn ($q) => $q->whereNull('completed_at'),
            ])
            ->get();

        return response()->json($houses);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => 'required|string|max:120',
            'description' => 'nullable|string|max:255',
        ]);

        $house = House::create($data);
        $house->members()->attach($request->user()->id, ['role' => HouseRole::OWNER->value]);

        return response()->json($house->load('members'), 201);
    }

    public function show(House $house): JsonResponse
    {
        Gate::authorize('view', $house);
        return response()->json($house->load('members'));
    }

    public function update(Request $request, House $house): JsonResponse
    {
        Gate::authorize('manage', $house);

        $data = $request->validate([
            'name' => 'required|string|max:120',
            'description' => 'nullable|string|max:255',
        ]);

        $house->update($data);

        return response()->json($house->load('members'));
    }

    public function destroy(House $house): JsonResponse
    {
        Gate::authorize('manage', $house);
        $house->delete();

        return response()->json(['message' => 'Residência excluída.']);
    }

    public function joinByCode(Request $request): JsonResponse
    {
        $data = $request->validate([
            'invite_code' => 'required|string',
        ]);

        $house = House::where('invite_code', strtoupper($data['invite_code']))->firstOrFail();

        $house->members()->syncWithoutDetaching([
            $request->user()->id => ['role' => HouseRole::RESIDENT->value],
        ]);

        return response()->json($house);
    }

    public function leave(Request $request, House $house): JsonResponse
    {
        Gate::authorize('view', $house);

        if ($house->getUserRole($request->user()) === HouseRole::OWNER) {
            return response()->json([
                'message' => 'Transfira a propriedade para outro morador ou exclua a residência.',
            ], 422);
        }

        $house->members()->detach($request->user()->id);

        return response()->json(['message' => 'Você saiu da residência.']);
    }

    public function updateMemberRole(Request $request, House $house, User $member): JsonResponse
    {
        Gate::authorize('manage', $house);

        $data = $request->validate([
            'role' => ['required', new Enum(HouseRole::class)],
        ]);

        $house->members()->updateExistingPivot($member->id, ['role' => $data['role']]);

        return response()->json(['message' => 'Papel atualizado.']);
    }

    public function removeMember(Request $request, House $house, User $member): JsonResponse
    {
        Gate::authorize('manage', $house);

        if ($request->user()->id === $member->id) {
            return response()->json(['message' => 'O dono não pode remover a si mesmo.'], 422);
        }

        $house->members()->detach($member->id);

        return response()->json(['message' => 'Membro removido da residência.']);
    }

    public function dashboard(House $house): JsonResponse
    {
        Gate::authorize('view', $house);

        $startOfWeek = now()->startOfWeek();
        $endOfWeek = now()->endOfWeek();

        $ranking = $house->members()
            ->withCount([
                'assignedTasks as completed_week_count' => fn ($q) => $q
                    ->where('house_id', $house->id)
                    ->whereBetween('completed_at', [$startOfWeek, $endOfWeek]),
            ])
            ->orderByDesc('completed_week_count')
            ->get(['users.id', 'users.name']);

        return response()->json([
            'pending_total' => $house->tasks()->whereNull('completed_at')->count(),
            'completed_this_week' => $house->tasks()->whereBetween('completed_at', [$startOfWeek, $endOfWeek])->count(),
            'due_this_week' => $house->tasks()->whereNull('completed_at')->whereBetween('due_date', [$startOfWeek, $endOfWeek])->count(),
            'high_priority_pending' => $house->tasks()->whereNull('completed_at')->where('priority', 'high')->count(),
            'ranking' => $ranking,
        ]);
    }
}
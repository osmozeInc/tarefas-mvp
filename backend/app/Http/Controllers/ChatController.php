<?php

namespace App\Http\Controllers;

use App\Models\House;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class ChatController extends Controller
{
    public function index(House $house): JsonResponse
    {
        Gate::authorize('view', $house);

        $messages = $house->messages()
            ->with('sender:id,name')
            ->latest()
            ->limit(100)
            ->get()
            ->reverse()
            ->values();

        return response()->json($messages);
    }

    public function store(Request $request, House $house): JsonResponse
    {
        Gate::authorize('interact', $house);

        $data = $request->validate([
            'content' => 'required|string|max:1000',
        ]);

        $message = $house->messages()->create([
            'user_id' => $request->user()->id,
            'content' => $data['content'],
        ]);

        return response()->json($message->load('sender:id,name'), 201);
    }
}
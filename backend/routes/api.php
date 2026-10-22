<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\ChatController;
use App\Http\Controllers\HouseController;
use App\Http\Controllers\TaskController;
use Illuminate\Support\Facades\Route;

// Rotas Públicas
Route::post('/register', [AuthController::class, 'register']);
Route::post('/login', [AuthController::class, 'login']);
Route::get('/vapid-public-key', fn () => response()->json(['key' => config('webpush.vapid.public_key')]));

// Rotas Protegidas (Sanctum)
Route::middleware('auth:sanctum')->group(function () {
    // Usuário, Push e Notificações
Route::get('/user', [AuthController::class, 'me']);
    Route::put('/user', [AuthController::class, 'updateProfile']);
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::post('/push-subscriptions', [AuthController::class, 'savePushSubscription']);
    Route::get('/notifications', [AuthController::class, 'notifications']);
    Route::post('/notifications/read-all', [AuthController::class, 'markAllNotificationsRead']); // <-- ESSA LINHA PRECISA ESTAR AQUI
    Route::patch('/notifications/{id}/read', [AuthController::class, 'markNotificationRead']);
    
    // Histórico Global (Bottom Menu)
    Route::get('/history', [TaskController::class, 'completedHistory']);

    // Residências (Grupos)
    Route::get('/houses', [HouseController::class, 'index']);
    Route::post('/houses', [HouseController::class, 'store']);
    Route::post('/houses/join', [HouseController::class, 'joinByCode']);
    Route::get('/houses/{house}', [HouseController::class, 'show']);
    Route::put('/houses/{house}', [HouseController::class, 'update']);
    Route::delete('/houses/{house}', [HouseController::class, 'destroy']);
    Route::post('/houses/{house}/leave', [HouseController::class, 'leave']);
    Route::get('/houses/{house}/dashboard', [HouseController::class, 'dashboard']);
    Route::patch('/houses/{house}/members/{member}/role', [HouseController::class, 'updateMemberRole']);
    Route::delete('/houses/{house}/members/{member}', [HouseController::class, 'removeMember']);

    // Tarefas por Residência
    Route::get('/houses/{house}/tasks', [TaskController::class, 'index']);
    Route::post('/houses/{house}/tasks', [TaskController::class, 'store']);
    Route::put('/houses/{house}/tasks/{task}', [TaskController::class, 'update']);
    Route::patch('/houses/{house}/tasks/{task}/toggle', [TaskController::class, 'toggleComplete']);
    Route::delete('/houses/{house}/tasks/{task}', [TaskController::class, 'destroy']);

    // Chat por Residência
    Route::get('/houses/{house}/messages', [ChatController::class, 'index']);
    Route::post('/houses/{house}/messages', [ChatController::class, 'store']);
});
<?php

namespace App\Policies;

use App\Enums\HouseRole;
use App\Models\House;
use App\Models\User;

class HousePolicy
{
    // Dono, Morador e Visitante podem visualizar a casa, tarefas e dashboard
    public function view(User $user, House $house): bool
    {
        return $house->getUserRole($user) !== null;
    }

    // Apenas Dono e Morador podem criar/editar/concluir tarefas e enviar mensagens no chat
    public function interact(User $user, House $house): bool
    {
        $role = $house->getUserRole($user);
        return in_array($role, [HouseRole::OWNER, HouseRole::RESIDENT], true);
    }

    // Apenas o Dono pode alterar configurações da casa, gerenciar papéis ou remover membros
    public function manage(User $user, House $house): bool
    {
        return $house->getUserRole($user) === HouseRole::OWNER;
    }
}
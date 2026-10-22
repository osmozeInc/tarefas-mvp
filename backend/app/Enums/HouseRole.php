<?php

namespace App\Enums;

enum HouseRole: string
{
    case OWNER = 'owner';       // Dono (Admin)
    case RESIDENT = 'resident'; // Morador
    case GUEST = 'guest';       // Visitante
}
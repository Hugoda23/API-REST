<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Si hay API_KEY configurada, las escrituras la exigen en la cabecera X-API-Key.
 * Las lecturas (GET/HEAD) quedan públicas.
 */
class ExigirApiKey
{
    public function handle(Request $request, Closure $next): Response
    {
        $clave = (string) config('app.api_key');

        if ($clave === '' || $request->isMethodSafe()) {
            return $next($request);
        }

        if (hash_equals($clave, (string) $request->header('X-API-Key'))) {
            return $next($request);
        }

        return response()->json(['message' => 'Falta o es incorrecta la cabecera X-API-Key.'], 401);
    }
}

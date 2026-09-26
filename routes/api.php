<?php

use App\Http\Controllers\Api\ProductoController;
use App\Http\Middleware\ExigirApiKey;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;

Route::get('/', fn () => [
    'nombre' => 'API-REST',
    'version' => '1.0.0',
    'recursos' => ['productos' => url('/api/productos')],
]);

Route::get('/health', function () {
    try {
        DB::select('select 1');

        return ['estado' => 'ok', 'base_de_datos' => 'ok'];
    } catch (Throwable) {
        return response()->json(['estado' => 'error', 'base_de_datos' => 'sin conexión'], 503);
    }
});

Route::middleware([ExigirApiKey::class, 'throttle:120,1'])->group(function () {
    Route::apiResource('productos', ProductoController::class)
        ->where(['producto' => '[0-9]+']);
});

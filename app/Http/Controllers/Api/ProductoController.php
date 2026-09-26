<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\ProductoRequest;
use App\Http\Resources\ProductoResource;
use App\Models\Producto;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class ProductoController extends Controller
{
    /**
     * GET /api/productos?buscar=&page=1&por_pagina=20
     */
    public function index(Request $request)
    {
        $porPagina = min(100, max(1, (int) $request->query('por_pagina', 20)));
        $buscar = trim((string) $request->query('buscar', ''));

        $productos = Producto::query()
            ->when($buscar !== '', fn ($q) => $q->whereRaw('lower(nombre) like ?', ['%'.mb_strtolower($buscar).'%']))
            ->orderBy('id')
            ->paginate($porPagina)
            ->withQueryString();

        return ProductoResource::collection($productos);
    }

    public function store(ProductoRequest $request)
    {
        $producto = Producto::create($request->datos());

        return (new ProductoResource($producto))
            ->response()
            ->setStatusCode(Response::HTTP_CREATED)
            ->header('Location', route('productos.show', $producto));
    }

    public function show(Producto $producto)
    {
        return new ProductoResource($producto);
    }

    public function update(ProductoRequest $request, Producto $producto)
    {
        $datos = $request->datos();

        if ($datos === []) {
            return response()->json(['message' => 'No se envió ningún campo para actualizar.'], 422);
        }

        $producto->update($datos);

        return new ProductoResource($producto);
    }

    public function destroy(Producto $producto)
    {
        $producto->delete();

        return response()->noContent();
    }
}

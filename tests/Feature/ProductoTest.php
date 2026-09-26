<?php

namespace Tests\Feature;

use App\Models\Producto;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProductoTest extends TestCase
{
    use RefreshDatabase;

    private array $nuevo = [
        'nombre' => 'Teclado',
        'descripcion' => 'Mecánico',
        'precio' => 350.5,
        'stock' => 10,
    ];

    public function test_health_responde_ok(): void
    {
        $this->getJson('/api/health')->assertOk()->assertJson(['estado' => 'ok']);
    }

    public function test_crea_un_producto(): void
    {
        $res = $this->postJson('/api/productos', $this->nuevo)
            ->assertCreated()
            ->assertJsonPath('data.nombre', 'Teclado')
            ->assertJsonPath('data.precio', 350.5)
            ->assertJsonPath('data.stock', 10);

        $this->assertStringEndsWith('/api/productos/'.$res->json('data.id'), $res->headers->get('Location'));
        $this->assertDatabaseHas('productos', ['nombre' => 'Teclado']);
    }

    public function test_valida_los_campos_al_crear(): void
    {
        $this->postJson('/api/productos', ['precio' => -1, 'stock' => 'x'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['nombre', 'precio', 'stock'])
            ->assertJsonPath('errors.nombre.0', 'El campo nombre es obligatorio.');
    }

    public function test_stock_por_defecto_es_cero(): void
    {
        $this->postJson('/api/productos', ['nombre' => 'Mouse', 'precio' => 90])
            ->assertCreated()
            ->assertJsonPath('data.stock', 0)
            ->assertJsonPath('data.descripcion', null);
    }

    public function test_lista_con_paginacion_y_busqueda(): void
    {
        Producto::factory()->create(['nombre' => 'Teclado']);
        Producto::factory()->create(['nombre' => 'Mouse']);

        $this->getJson('/api/productos')->assertOk()->assertJsonPath('meta.total', 2);

        $this->getJson('/api/productos?buscar=MOU')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.nombre', 'Mouse');

        $this->getJson('/api/productos?por_pagina=1&page=2')
            ->assertOk()
            ->assertJsonPath('data.0.nombre', 'Mouse')
            ->assertJsonPath('meta.last_page', 2);
    }

    public function test_muestra_uno_y_404_si_no_existe(): void
    {
        $producto = Producto::factory()->create();

        $this->getJson("/api/productos/{$producto->id}")->assertOk()->assertJsonPath('data.id', $producto->id);
        $this->getJson('/api/productos/999')->assertNotFound()->assertJson(['message' => 'Producto no encontrado.']);
        $this->getJson('/api/productos/abc')->assertNotFound();
    }

    public function test_put_reemplaza_el_producto_completo(): void
    {
        $producto = Producto::factory()->create($this->nuevo);

        $this->putJson("/api/productos/{$producto->id}", ['nombre' => 'Teclado 2', 'precio' => 400])
            ->assertOk()
            ->assertJsonPath('data.nombre', 'Teclado 2')
            ->assertJsonPath('data.descripcion', null)
            ->assertJsonPath('data.stock', 0);

        $this->putJson("/api/productos/{$producto->id}", ['stock' => 3])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['nombre', 'precio']);
    }

    public function test_patch_actualiza_solo_lo_enviado(): void
    {
        $producto = Producto::factory()->create($this->nuevo);

        $this->patchJson("/api/productos/{$producto->id}", ['stock' => 5])
            ->assertOk()
            ->assertJsonPath('data.stock', 5)
            ->assertJsonPath('data.nombre', 'Teclado')
            ->assertJsonPath('data.descripcion', 'Mecánico');

        $this->patchJson("/api/productos/{$producto->id}", [])->assertUnprocessable();
        $this->patchJson('/api/productos/999', ['stock' => 1])->assertNotFound();
    }

    public function test_elimina(): void
    {
        $producto = Producto::factory()->create();

        $this->deleteJson("/api/productos/{$producto->id}")->assertNoContent();
        $this->assertDatabaseMissing('productos', ['id' => $producto->id]);
        $this->deleteJson("/api/productos/{$producto->id}")->assertNotFound();
    }

    public function test_con_api_key_las_escrituras_la_exigen_y_las_lecturas_no(): void
    {
        config(['app.api_key' => 'clave-de-prueba']);

        $this->postJson('/api/productos', $this->nuevo)->assertUnauthorized();
        $this->postJson('/api/productos', $this->nuevo, ['X-API-Key' => 'otra'])->assertUnauthorized();
        $this->postJson('/api/productos', $this->nuevo, ['X-API-Key' => 'clave-de-prueba'])->assertCreated();
        $this->getJson('/api/productos')->assertOk();
    }

    public function test_ruta_inexistente_da_404_en_json(): void
    {
        $this->getJson('/api/nada')->assertNotFound()->assertJson(['message' => 'No existe la ruta GET /api/nada']);
    }

    public function test_metodo_no_permitido_da_405(): void
    {
        $this->postJson('/api/productos/1')->assertStatus(405);
    }
}

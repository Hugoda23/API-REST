<?php

namespace Database\Factories;

use App\Models\Producto;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Producto>
 */
class ProductoFactory extends Factory
{
    private const NOMBRES = [
        'Teclado mecánico', 'Mouse inalámbrico', 'Monitor 24"', 'Laptop 14"', 'Audífonos Bluetooth',
        'Cámara web HD', 'Memoria USB 64 GB', 'Disco SSD 1 TB', 'Router Wi-Fi 6', 'Impresora láser',
        'Silla ergonómica', 'Escritorio de madera', 'Lámpara LED', 'Cable HDMI 2 m', 'Parlante portátil',
        'Tablet 10"', 'Cargador USB-C', 'Mochila para laptop', 'Micrófono de condensador', 'Hub USB 4 puertos',
    ];

    public function definition(): array
    {
        return [
            'nombre' => $this->faker->unique()->randomElement(self::NOMBRES),
            'descripcion' => $this->faker->optional()->randomElement([
                'Producto nuevo con garantía de un año.',
                'Ideal para oficina y estudio.',
                'Últimas unidades disponibles.',
                'Incluye cable y manual de uso.',
            ]),
            'precio' => $this->faker->randomFloat(2, 5, 5000),
            'stock' => $this->faker->numberBetween(0, 200),
        ];
    }
}

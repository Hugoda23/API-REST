<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class ProductoRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        // PATCH sólo valida los campos que vengan; POST y PUT exigen el recurso completo.
        $requerido = $this->isMethod('patch') ? 'sometimes' : 'required';

        return [
            'nombre' => [$requerido, 'string', 'max:120'],
            'descripcion' => ['sometimes', 'nullable', 'string'],
            'precio' => [$requerido, 'numeric', 'min:0', 'max:99999999.99'],
            'stock' => ['sometimes', 'integer', 'min:0'],
        ];
    }

    public function messages(): array
    {
        return [
            'required' => 'El campo :attribute es obligatorio.',
            'string' => 'El campo :attribute debe ser texto.',
            'numeric' => 'El campo :attribute debe ser un número.',
            'integer' => 'El campo :attribute debe ser un número entero.',
            'nombre.max' => 'El nombre no puede pasar de 120 caracteres.',
            'precio.min' => 'El precio no puede ser negativo.',
            'precio.max' => 'El precio es demasiado grande.',
            'stock.min' => 'El stock no puede ser negativo.',
        ];
    }

    /**
     * Datos listos para guardar. En PUT, lo que no se envía vuelve a su valor por defecto.
     */
    public function datos(): array
    {
        $datos = $this->validated();

        if ($this->isMethod('put')) {
            $datos += ['descripcion' => null, 'stock' => 0];
        }

        return $datos;
    }
}

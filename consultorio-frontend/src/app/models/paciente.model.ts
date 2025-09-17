// src/app/models/paciente.model.ts
export interface Paciente {
  id: string;
  cedula: string;
  nombres: string;
  apellidos: string;
  fechaNacimiento: Date;
  edad: number;
  genero: 'M' | 'F';
  telefono: string;
  email?: string;
  direccion: string;
  estadoCivil: string;
  ocupacion?: string;
  contactoEmergencia?: {
    nombre?: string;
    telefono?: string;
    relacion?: string;
  };
  seguroMedico?: string;
  alergias?: string[];
  medicamentosActuales?: string[];
  enfermedadesCronicas?: string[];
  fechaRegistro: Date;
  activo: boolean;
}
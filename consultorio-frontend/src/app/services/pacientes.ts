
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Paciente {
  pacienteId: number;
  cedula: string;
  nombres: string;
  apellidos: string;
  fechaNacimiento: string;
  genero: string;
  direccion?: string;
  telefono?: string;
  celular?: string;
  email?: string;
  estadoCivil?: string;
  ocupacion?: string;
  contactoEmergencia?: string;
  telefonoEmergencia?: string;
  tipoSangre?: string;
  alergias?: string;
  estado: boolean;
  fechaRegistro: string;
  nombreCompleto?: string;
  edad?: number;
}

export interface ApiResponse {
  success: boolean;
  data?: any;
  message: string;
  error?: string;
  total?: number;
}

@Injectable({
  providedIn: 'root'
})
export class PacientesService {
  private apiUrl = 'https://localhost:7037/api/Pacientes'; // URL de tu backend

  constructor(private http: HttpClient) { }

  // Obtener todos los pacientes
  obtenerPacientes(): Observable<ApiResponse> {
    return this.http.get<ApiResponse>(this.apiUrl);
  }

  // Obtener paciente por ID
  obtenerPaciente(id: number): Observable<ApiResponse> {
    return this.http.get<ApiResponse>(`${this.apiUrl}/${id}`);
  }

  // Crear nuevo paciente
  crearPaciente(paciente: Partial<Paciente>): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(this.apiUrl, paciente);
  }

  // Actualizar paciente
  actualizarPaciente(id: number, paciente: Paciente): Observable<ApiResponse> {
    return this.http.put<ApiResponse>(`${this.apiUrl}/${id}`, paciente);
  }

  // Eliminar paciente
  eliminarPaciente(id: number): Observable<ApiResponse> {
    return this.http.delete<ApiResponse>(`${this.apiUrl}/${id}`);
  }

  // Probar conexión con la API
  probarConexion(): Observable<ApiResponse> {
    return this.http.get<ApiResponse>(`${this.apiUrl}/test`);
  }

  // Calcular edad
  calcularEdad(fechaNacimiento: string): number {
    const hoy = new Date();
    const nacimiento = new Date(fechaNacimiento);
    let edad = hoy.getFullYear() - nacimiento.getFullYear();
    const mesActual = hoy.getMonth();
    const mesNacimiento = nacimiento.getMonth();
    
    if (mesNacimiento > mesActual || 
        (mesNacimiento === mesActual && nacimiento.getDate() > hoy.getDate())) {
      edad--;
    }
    
    return edad;
  }

  // Obtener iniciales
  getInitials(nombres: string, apellidos: string): string {
    const inicialNombre = nombres.charAt(0).toUpperCase();
    const inicialApellido = apellidos.charAt(0).toUpperCase();
    return inicialNombre + inicialApellido;
  }
}

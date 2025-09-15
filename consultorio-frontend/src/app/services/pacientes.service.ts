// src/app/services/pacientes.service.ts
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { Paciente } from '../models/paciente.model';

@Injectable({
  providedIn: 'root'
})
export class PacientesService {
  private pacientesSubject = new BehaviorSubject<Paciente[]>([]);
  public pacientes$ = this.pacientesSubject.asObservable();

  constructor() {
    // Cargar datos de ejemplo
    this.cargarDatosEjemplo();
  }

  private cargarDatosEjemplo(): void {
    const pacientesEjemplo: Paciente[] = [
      {
        id: '1',
        cedula: '1717123456',
        nombres: 'María José',
        apellidos: 'González Pérez',
        fechaNacimiento: new Date('1985-03-15'),
        edad: 39,
        genero: 'F',
        telefono: '0987654321',
        email: 'maria.gonzalez@email.com',
        direccion: 'Malchinguí, Calle Principal 123',
        estadoCivil: 'Casada',
        ocupacion: 'Profesora',
        contactoEmergencia: {
          nombre: 'Carlos González',
          telefono: '0987654322',
          relacion: 'Esposo'
        },
        alergias: ['Penicilina'],
        medicamentosActuales: ['Omeprazol 20mg'],
        fechaRegistro: new Date(),
        activo: true
      }
    ];
    this.pacientesSubject.next(pacientesEjemplo);
  }

  // Obtener todos los pacientes
  obtenerTodos(): Observable<Paciente[]> {
    return this.pacientes$;
  }

  // Obtener paciente por ID
  obtenerPorId(id: string): Observable<Paciente | undefined> {
    const pacientes = this.pacientesSubject.value;
    return of(pacientes.find(p => p.id === id));
  }

  // Buscar pacientes
  buscarPacientes(termino: string): Observable<Paciente[]> {
    const pacientes = this.pacientesSubject.value;
    const resultado = pacientes.filter(paciente =>
      paciente.nombres.toLowerCase().includes(termino.toLowerCase()) ||
      paciente.apellidos.toLowerCase().includes(termino.toLowerCase()) ||
      paciente.cedula.includes(termino)
    );
    return of(resultado);
  }

  // Agregar nuevo paciente
  agregarPaciente(paciente: Paciente): Observable<Paciente> {
    const pacientes = this.pacientesSubject.value;
    paciente.id = this.generarId();
    paciente.fechaRegistro = new Date();
    paciente.edad = this.calcularEdad(paciente.fechaNacimiento);
    
    const nuevosPacientes = [...pacientes, paciente];
    this.pacientesSubject.next(nuevosPacientes);
    
    return of(paciente);
  }

  // Actualizar paciente
  actualizarPaciente(paciente: Paciente): Observable<Paciente> {
    const pacientes = this.pacientesSubject.value;
    const indice = pacientes.findIndex(p => p.id === paciente.id);
    
    if (indice !== -1) {
      paciente.edad = this.calcularEdad(paciente.fechaNacimiento);
      pacientes[indice] = { ...paciente };
      this.pacientesSubject.next([...pacientes]);
    }
    
    return of(paciente);
  }

  // Eliminar paciente (marcar como inactivo)
  eliminarPaciente(id: string): Observable<boolean> {
    const pacientes = this.pacientesSubject.value;
    const indice = pacientes.findIndex(p => p.id === id);
    
    if (indice !== -1) {
      pacientes[indice].activo = false;
      this.pacientesSubject.next([...pacientes]);
      return of(true);
    }
    
    return of(false);
  }

  // Validar cédula ecuatoriana
  validarCedulaEcuatoriana(cedula: string): boolean {
    if (cedula.length !== 10) return false;
    
    const digitos = cedula.split('').map(Number);
    const provincia = parseInt(cedula.substring(0, 2));
    
    if (provincia < 1 || provincia > 24) return false;
    
    let suma = 0;
    for (let i = 0; i < 9; i++) {
      let digito = digitos[i];
      if (i % 2 === 0) {
        digito *= 2;
        if (digito > 9) digito -= 9;
      }
      suma += digito;
    }
    
    const digitoVerificador = 10 - (suma % 10);
    return digitoVerificador === digitos[9] || (digitoVerificador === 10 && digitos[9] === 0);
  }

  // Métodos privados
  private generarId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  private calcularEdad(fechaNacimiento: Date): number {
    const hoy = new Date();
    const nacimiento = new Date(fechaNacimiento);
    let edad = hoy.getFullYear() - nacimiento.getFullYear();
    const mesActual = hoy.getMonth();
    const mesNacimiento = nacimiento.getMonth();
    
    if (mesActual < mesNacimiento || (mesActual === mesNacimiento && hoy.getDate() < nacimiento.getDate())) {
      edad--;
    }
    
    return edad;
  }
}
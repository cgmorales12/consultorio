// src/app/components/pacientes/pacientes.component.ts
import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { PacientesService } from '../../services/pacientes.service';
import { Paciente } from '../../models/paciente.model';

@Component({
  selector: 'app-pacientes',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './pacientes.component.html',
  styleUrls: ['./pacientes.component.css']
})
export class PacientesComponent implements OnInit {
  // Propiedades del componente
  formularioPaciente!: FormGroup;
  mostrarFormulario = false;
  pacienteSeleccionado: Paciente | null = null;
  terminoBusqueda = '';
  pacientesFiltrados: Paciente[] = [];
  cargando = false;
  maxFechaNacimiento = new Date().toISOString().split('T')[0];

  constructor(
    private fb: FormBuilder,
    private pacientesService: PacientesService
  ) {
    this.inicializarFormulario();
  }

  ngOnInit(): void {
    this.cargarPacientes();
  }

  // Inicializar el formulario con validaciones
  private inicializarFormulario(): void {
    this.formularioPaciente = this.fb.group({
      cedula: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(10)]],
      nombres: ['', [Validators.required, Validators.minLength(2)]],
      apellidos: ['', [Validators.required, Validators.minLength(2)]],
      fechaNacimiento: ['', Validators.required],
      genero: ['', Validators.required],
      telefono: ['', [Validators.required, Validators.minLength(10)]],
      email: ['', [Validators.email]],
      direccion: ['', Validators.required],
      estadoCivil: ['', Validators.required],
      ocupacion: [''],
      contactoEmergenciaNombre: [''],
      contactoEmergenciaTelefono: [''],
      contactoEmergenciaRelacion: [''],
      alergias: [''],
      medicamentosActuales: [''],
      enfermedadesCronicas: ['']
    });
  }

  // Cargar lista de pacientes
  cargarPacientes(): void {
    this.cargando = true;
    this.pacientesService.obtenerTodos().subscribe({
      next: (pacientes) => {
        this.pacientesFiltrados = pacientes.filter(p => p.activo);
        this.cargando = false;
      },
      error: (error) => {
        console.error('Error al cargar pacientes:', error);
        this.cargando = false;
      }
    });
  }

  // Buscar pacientes
  buscarPacientes(): void {
    if (this.terminoBusqueda.trim()) {
      this.pacientesService.buscarPacientes(this.terminoBusqueda).subscribe({
        next: (pacientes) => {
          this.pacientesFiltrados = pacientes.filter(p => p.activo);
        }
      });
    } else {
      this.cargarPacientes();
    }
  }

  // Abrir formulario para nuevo paciente
  nuevoPaciente(): void {
    this.pacienteSeleccionado = null;
    this.formularioPaciente.reset();
    this.mostrarFormulario = true;
  }

  // Abrir formulario para editar paciente
  editarPaciente(paciente: Paciente): void {
    this.pacienteSeleccionado = paciente;
    this.formularioPaciente.patchValue({
      cedula: paciente.cedula,
      nombres: paciente.nombres,
      apellidos: paciente.apellidos,
      fechaNacimiento: paciente.fechaNacimiento.toISOString().split('T')[0],
      genero: paciente.genero,
      telefono: paciente.telefono,
      email: paciente.email,
      direccion: paciente.direccion,
      estadoCivil: paciente.estadoCivil,
      ocupacion: paciente.ocupacion,
      contactoEmergenciaNombre: paciente.contactoEmergencia?.nombre ?? '',
      contactoEmergenciaTelefono: paciente.contactoEmergencia?.telefono ?? '',
      contactoEmergenciaRelacion: paciente.contactoEmergencia?.relacion ?? '',
      alergias: paciente.alergias?.join(', '),
      medicamentosActuales: paciente.medicamentosActuales?.join(', '),
      enfermedadesCronicas: paciente.enfermedadesCronicas?.join(', ')
    });
    this.mostrarFormulario = true;
  }

  // Guardar paciente (crear o actualizar)
  guardarPaciente(): void {
    if (this.formularioPaciente.valid) {
      const formData = this.formularioPaciente.value;
      
      // Validar cédula ecuatoriana
      if (!this.pacientesService.validarCedulaEcuatoriana(formData.cedula)) {
        alert('La cédula ingresada no es válida para Ecuador');
        return;
      }

      const contactoEmergencia = this.obtenerContactoEmergencia(formData);

      const paciente: Paciente = {
        id: this.pacienteSeleccionado?.id || '',
        cedula: formData.cedula,
        nombres: formData.nombres,
        apellidos: formData.apellidos,
        fechaNacimiento: new Date(formData.fechaNacimiento),
        edad: 0, // Se calcula automáticamente en el servicio
        genero: formData.genero,
        telefono: formData.telefono,
        email: formData.email,
        direccion: formData.direccion,
        estadoCivil: formData.estadoCivil,
        ocupacion: formData.ocupacion,
        ...(contactoEmergencia ? { contactoEmergencia } : {}),
        alergias: formData.alergias ? formData.alergias.split(',').map((a: string) => a.trim()) : [],
        medicamentosActuales: formData.medicamentosActuales ? formData.medicamentosActuales.split(',').map((m: string) => m.trim()) : [],
        enfermedadesCronicas: formData.enfermedadesCronicas ? formData.enfermedadesCronicas.split(',').map((e: string) => e.trim()) : [],
        fechaRegistro: this.pacienteSeleccionado?.fechaRegistro || new Date(),
        activo: true
      };

      const operacion = this.pacienteSeleccionado ? 
        this.pacientesService.actualizarPaciente(paciente) : 
        this.pacientesService.agregarPaciente(paciente);

      operacion.subscribe({
        next: () => {
          this.cerrarFormulario();
          this.cargarPacientes();
          alert(this.pacienteSeleccionado ? 'Paciente actualizado correctamente' : 'Paciente registrado correctamente');
        },
        error: (error) => {
          console.error('Error al guardar paciente:', error);
          alert('Error al guardar el paciente');
        }
      });
    } else {
      alert('Por favor, complete todos los campos requeridos');
    }
  }

  // Eliminar paciente
  eliminarPaciente(id: string, nombreCompleto: string): void {
    if (confirm(`¿Está seguro de eliminar al paciente ${nombreCompleto}?`)) {
      this.pacientesService.eliminarPaciente(id).subscribe({
        next: (eliminado) => {
          if (eliminado) {
            this.cargarPacientes();
            alert('Paciente eliminado correctamente');
          } else {
            alert('Error al eliminar el paciente');
          }
        },
        error: (error) => {
          console.error('Error al eliminar paciente:', error);
          alert('Error al eliminar el paciente');
        }
      });
    }
  }

  // Cerrar formulario
  cerrarFormulario(): void {
    this.mostrarFormulario = false;
    this.pacienteSeleccionado = null;
    this.formularioPaciente.reset();
  }

  // Getter para validación del formulario
  get esFormularioValido(): boolean {
    return this.formularioPaciente.valid;
  }

  private obtenerContactoEmergencia(formData: any): Paciente['contactoEmergencia'] | null {
    const nombre = (formData.contactoEmergenciaNombre ?? '').trim();
    const telefono = (formData.contactoEmergenciaTelefono ?? '').trim();
    const relacion = (formData.contactoEmergenciaRelacion ?? '').trim();

    if (!nombre && !telefono && !relacion) {
      return null;
    }

    return {
      ...(nombre ? { nombre } : {}),
      ...(telefono ? { telefono } : {}),
      ...(relacion ? { relacion } : {})
    };
  }

  // Método para obtener errores de un campo
  obtenerError(campo: string): string {
    const control = this.formularioPaciente.get(campo);
    if (control?.errors && control.touched) {
      if (control.errors['required']) return `${campo} es requerido`;
      if (control.errors['minlength']) return `${campo} es muy corto`;
      if (control.errors['email']) return 'Email inválido';
    }
    return '';
  }
}

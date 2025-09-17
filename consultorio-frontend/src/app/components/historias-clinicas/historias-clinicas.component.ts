import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize, distinctUntilChanged } from 'rxjs/operators';
import { HistoriasClinicasService } from '../../services/historias-clinicas.service';
import { ConsultaMedica, HistoriaClinica, PlantillaConsulta } from '../../models/historia-clinica.model';
import { PacientesService as PacientesApiService, Paciente as PacienteApi } from '../../services/pacientes';

@Component({
  selector: 'app-historias-clinicas',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './historias-clinicas.component.html',
  styleUrls: ['./historias-clinicas.component.css']
})
export class HistoriasClinicasComponent implements OnInit {
  historias: HistoriaClinica[] = [];
  plantillas: PlantillaConsulta[] = [];
  historiaSeleccionada: HistoriaClinica | null = null;
  antecedentesForm: FormGroup;
  consultaForm: FormGroup;
  alertasConsulta: string[] = [];
  bmiActual: number | null = null;
  bmiClasificacion = '';
  cargandoHistorias = false;
  cargandoPlantillas = false;
  cargandoPacientes = false;
  guardandoAntecedentes = false;
  guardandoConsulta = false;
  creandoHistoria = false;
  mensajeError?: string;
  pacientes: PacienteApi[] = [];
  pacienteControl = new FormControl<number | null>(null);
  pacienteFiltradoId: number | null = null;

  constructor(
    private readonly fb: FormBuilder,
    private readonly historiasService: HistoriasClinicasService,
    private readonly pacientesService: PacientesApiService
  ) {
    this.antecedentesForm = this.fb.group({
      antecedentesPersonales: [''],
      antecedentesFamiliares: [''],
      vacunas: [''],
      alergias: ['']
    });

    this.consultaForm = this.fb.group({
      fechaConsulta: [this.hoy, Validators.required],
      plantillaId: [null],
      motivoConsulta: ['', [Validators.required, Validators.maxLength(200)]],
      sintomas: ['', [Validators.required, Validators.maxLength(2000)]],
      diagnostico: ['', [Validators.required, Validators.maxLength(2000)]],
      tratamiento: ['', [Validators.required, Validators.maxLength(2000)]],
      observaciones: [''],
      pesoKg: [null, [Validators.required, Validators.min(1)]],
      estaturaCm: [null, [Validators.required, Validators.min(40)]],
      temperaturaC: [null],
      frecuenciaCardiaca: [null],
      presionSistolica: [null],
      presionDiastolica: [null]
    });
  }

  private get hoy(): string {
    return new Date().toISOString().split('T')[0];
  }

  ngOnInit(): void {
    this.cargarPlantillas();
    this.cargarPacientes();
    this.cargarHistorias();

    this.pacienteControl.valueChanges
      .pipe(distinctUntilChanged())
      .subscribe((pacienteId) => {
        this.cargarHistorias(pacienteId ?? undefined);
      });

    this.consultaForm.get('pesoKg')?.valueChanges.subscribe(() => this.actualizarImc());
    this.consultaForm.get('estaturaCm')?.valueChanges.subscribe(() => this.actualizarImc());
    this.consultaForm.get('plantillaId')?.valueChanges.subscribe((id) => this.aplicarPlantilla(id));
  }

  cargarHistorias(pacienteId?: number): void {
    this.pacienteFiltradoId = pacienteId ?? null;
    this.cargandoHistorias = true;
    this.mensajeError = undefined;

    this.historiasService.obtenerHistorias(pacienteId)
      .pipe(finalize(() => (this.cargandoHistorias = false)))
      .subscribe({
        next: (historias) => {
          this.historias = historias;

          if (historias.length === 0) {
            this.historiaSeleccionada = null;
            this.alertasConsulta = [];
            this.bmiActual = null;
            this.bmiClasificacion = '';
            return;
          }

          if (this.historiaSeleccionada) {
            const actualizada = historias.find(h => h.historiaClinicaId === this.historiaSeleccionada!.historiaClinicaId);
            if (actualizada) {
              this.seleccionarHistoria(actualizada);
              return;
            }
          }

          this.seleccionarHistoria(historias[0]);
        },
        error: (error) => {
          console.error('No se pudieron cargar las historias clínicas', error);
          this.mensajeError = 'No se pudieron cargar las historias clínicas. Intenta nuevamente.';
        }
      });
  }

  cargarPlantillas(): void {
    this.cargandoPlantillas = true;
    this.historiasService.obtenerPlantillas()
      .pipe(finalize(() => (this.cargandoPlantillas = false)))
      .subscribe({
        next: (plantillas) => (this.plantillas = plantillas),
        error: (error) => console.error('No se pudieron cargar las plantillas de consulta', error)
      });
  }

  cargarPacientes(): void {
    this.cargandoPacientes = true;
    this.pacientesService.obtenerPacientes()
      .pipe(finalize(() => (this.cargandoPacientes = false)))
      .subscribe({
        next: (response) => {
          const data = Array.isArray(response.data) ? (response.data as PacienteApi[]) : [];
          this.pacientes = data;
        },
        error: (error) => {
          console.error('No se pudieron cargar los pacientes', error);
          this.pacientes = [];
        }
      });
  }

  crearHistoriaParaPaciente(): void {
    const pacienteId = this.pacienteControl.value;
    if (!pacienteId) {
      return;
    }

    const existente = this.historias.find(h => h.pacienteId === pacienteId);
    if (existente) {
      this.seleccionarHistoria(existente);
      return;
    }

    this.creandoHistoria = true;
    this.mensajeError = undefined;

    this.historiasService.crearHistoria({ pacienteId })
      .pipe(finalize(() => (this.creandoHistoria = false)))
      .subscribe({
        next: (historia) => {
          this.actualizarListado(historia);
          this.seleccionarHistoria(historia);
        },
        error: (error) => {
          console.error('No se pudo crear la historia clínica', error);
          this.mensajeError = 'No se pudo crear la historia clínica para el paciente seleccionado.';
        }
      });
  }

  seleccionarHistoria(historia: HistoriaClinica): void {
    this.historiaSeleccionada = historia;
    this.alertasConsulta = [];
    this.bmiActual = null;
    this.bmiClasificacion = '';

    this.antecedentesForm.patchValue({
      antecedentesPersonales: historia.antecedentesPersonales ?? '',
      antecedentesFamiliares: historia.antecedentesFamiliares ?? '',
      vacunas: historia.vacunas ?? '',
      alergias: historia.alergias ?? ''
    });

    this.consultaForm.reset({
      fechaConsulta: this.hoy,
      plantillaId: null,
      motivoConsulta: '',
      sintomas: '',
      diagnostico: '',
      tratamiento: '',
      observaciones: '',
      pesoKg: null,
      estaturaCm: null,
      temperaturaC: null,
      frecuenciaCardiaca: null,
      presionSistolica: null,
      presionDiastolica: null
    });
  }

  guardarAntecedentes(): void {
    if (!this.historiaSeleccionada) {
      return;
    }

    this.guardandoAntecedentes = true;
    const payload = this.antecedentesForm.value;

    this.historiasService.actualizarHistoria(this.historiaSeleccionada.historiaClinicaId, payload)
      .pipe(finalize(() => (this.guardandoAntecedentes = false)))
      .subscribe({
        next: (historiaActualizada) => {
          this.actualizarListado(historiaActualizada);
          this.historiaSeleccionada = historiaActualizada;
        },
        error: (error) => {
          console.error('No se pudieron guardar los antecedentes', error);
          this.mensajeError = 'Ocurrió un error al guardar los antecedentes.';
        }
      });
  }

  registrarConsulta(): void {
    if (!this.historiaSeleccionada) {
      return;
    }

    if (this.consultaForm.invalid) {
      this.consultaForm.markAllAsTouched();
      return;
    }

    const valores = this.consultaForm.value;
    const payload = {
      fechaConsulta: valores.fechaConsulta,
      motivoConsulta: valores.motivoConsulta,
      sintomas: valores.sintomas,
      diagnostico: valores.diagnostico,
      tratamiento: valores.tratamiento,
      observaciones: valores.observaciones || undefined,
      pesoKg: Number(valores.pesoKg),
      estaturaCm: Number(valores.estaturaCm),
      temperaturaC: valores.temperaturaC !== null && valores.temperaturaC !== undefined ? Number(valores.temperaturaC) : undefined,
      frecuenciaCardiaca: valores.frecuenciaCardiaca !== null && valores.frecuenciaCardiaca !== undefined ? Number(valores.frecuenciaCardiaca) : undefined,
      presionSistolica: valores.presionSistolica !== null && valores.presionSistolica !== undefined ? Number(valores.presionSistolica) : undefined,
      presionDiastolica: valores.presionDiastolica !== null && valores.presionDiastolica !== undefined ? Number(valores.presionDiastolica) : undefined
    };

    this.guardandoConsulta = true;
    this.alertasConsulta = [];

    this.historiasService.registrarConsulta(this.historiaSeleccionada.historiaClinicaId, payload)
      .pipe(finalize(() => (this.guardandoConsulta = false)))
      .subscribe({
        next: (consulta) => {
          this.alertasConsulta = consulta.alertas ?? [];
          this.bmiActual = consulta.imc;
          this.bmiClasificacion = consulta.clasificacionImc;
          this.recargarHistoria(this.historiaSeleccionada!.historiaClinicaId);
          this.consultaForm.reset({
            fechaConsulta: this.hoy,
            plantillaId: null,
            motivoConsulta: '',
            sintomas: '',
            diagnostico: '',
            tratamiento: '',
            observaciones: '',
            pesoKg: null,
            estaturaCm: null,
            temperaturaC: null,
            frecuenciaCardiaca: null,
            presionSistolica: null,
            presionDiastolica: null
          });
        },
        error: (error) => {
          console.error('No se pudo registrar la consulta médica', error);
          if (error.error?.errores?.length) {
            this.alertasConsulta = error.error.errores;
          } else {
            this.mensajeError = 'Ocurrió un error al registrar la consulta médica.';
          }
        }
      });
  }

  formatearFecha(fecha: string): string {
    if (!fecha) {
      return '—';
    }

    const date = new Date(fecha);
    if (Number.isNaN(date.getTime())) {
      return '—';
    }

    return date.toLocaleDateString('es-EC', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  }

  obtenerIconoAlerta(alerta: string): string {
    if (alerta.toLowerCase().includes('fiebre')) {
      return 'fa-thermometer-half';
    }
    if (alerta.toLowerCase().includes('presión')) {
      return 'fa-heartbeat';
    }
    if (alerta.toLowerCase().includes('frecuencia')) {
      return 'fa-heart';
    }
    if (alerta.toLowerCase().includes('imc')) {
      return 'fa-weight';
    }
    return 'fa-exclamation-circle';
  }

  private aplicarPlantilla(plantillaId: number | null): void {
    if (!plantillaId) {
      return;
    }

    const plantilla = this.plantillas.find(p => p.plantillaConsultaId === plantillaId);
    if (!plantilla) {
      return;
    }

    this.consultaForm.patchValue({
      motivoConsulta: plantilla.motivoConsulta ?? this.consultaForm.value.motivoConsulta,
      sintomas: plantilla.sintomas ?? this.consultaForm.value.sintomas,
      diagnostico: plantilla.diagnostico ?? this.consultaForm.value.diagnostico,
      tratamiento: plantilla.tratamiento ?? this.consultaForm.value.tratamiento,
      observaciones: plantilla.observaciones ?? this.consultaForm.value.observaciones
    });
  }

  private actualizarImc(): void {
    const peso = Number(this.consultaForm.get('pesoKg')?.value);
    const estatura = Number(this.consultaForm.get('estaturaCm')?.value);

    if (peso > 0 && estatura > 0) {
      const estaturaMetros = estatura / 100;
      const imc = peso / (estaturaMetros * estaturaMetros);
      this.bmiActual = parseFloat(imc.toFixed(2));
      this.bmiClasificacion = this.clasificarImc(this.bmiActual);
    } else {
      this.bmiActual = null;
      this.bmiClasificacion = '';
    }
  }

  private clasificarImc(imc: number | null): string {
    if (imc === null) {
      return '';
    }
    if (imc < 18.5) {
      return 'Bajo peso';
    }
    if (imc < 25) {
      return 'Normal';
    }
    if (imc < 30) {
      return 'Sobrepeso';
    }
    return 'Obesidad';
  }

  private recargarHistoria(id: number): void {
    this.historiasService.obtenerHistoria(id).subscribe({
      next: (historia) => {
        this.actualizarListado(historia);
        this.historiaSeleccionada = historia;
      },
      error: (error) => console.error('No se pudo actualizar la historia clínica seleccionada', error)
    });
  }

  private actualizarListado(historiaActualizada: HistoriaClinica): void {
    const indice = this.historias.findIndex(h => h.historiaClinicaId === historiaActualizada.historiaClinicaId);
    if (indice >= 0) {
      const copia = [...this.historias];
      copia[indice] = historiaActualizada;
      this.historias = copia;
    } else {
      this.historias = [...this.historias, historiaActualizada];
    }
  }

  get historialConsultas(): ConsultaMedica[] {
    const consultas = this.historiaSeleccionada?.consultas ?? [];

    return [...consultas].sort((a, b) =>
      new Date(b.fechaConsulta).getTime() - new Date(a.fechaConsulta).getTime()
    );
  }
}

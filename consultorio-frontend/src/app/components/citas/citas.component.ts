import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable, Subject, interval } from 'rxjs';
import { finalize, switchMap, takeUntil, tap } from 'rxjs/operators';
import { AgendaSemanalDia, Cita, CitaPayload, DailyStats, EstadoCita } from '../../models/cita.model';
import { HorarioAtencion, HorarioAtencionPayload } from '../../models/horario-atencion.model';
import { CitasService } from '../../services/citas.service';
import { PacientesService } from '../../services/pacientes.service';
import { Paciente } from '../../models/paciente.model';
import { HorariosService } from '../../services/horarios.service';

type VistaCitas = 'agenda' | 'semana' | 'lista';

type QuickAction = {
  label: string;
  estado: EstadoCita;
  icon: string;
  theme: 'primary' | 'success' | 'warning';
};

type ModoPaciente = 'existente' | 'nuevo';

@Component({
  selector: 'app-citas',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './citas.component.html',
  styleUrls: ['./citas.component.css']
})
export class CitasComponent implements OnInit, OnDestroy {
  view: VistaCitas = 'agenda';
  viewOptions = [
    { id: 'agenda' as VistaCitas, label: 'Agenda diaria', icon: 'fa-calendar-day' },
    { id: 'semana' as VistaCitas, label: 'Calendario semanal', icon: 'fa-calendar-week' },
    { id: 'lista' as VistaCitas, label: 'Lista completa', icon: 'fa-list' }
  ];

  selectedDate = new Date();
  selectedDateInput = this.toDateString(this.selectedDate);

  dailyAppointments: Cita[] = [];
  weeklyAgenda: AgendaSemanalDia[] = [];
  allAppointments: Cita[] = [];
  stats: DailyStats | null = null;
  availableSlots: { start: string; end: string }[] = [];
  horario?: HorarioAtencion;

  horarioForm: FormGroup;
  guardandoHorarios = false;
  mensajeHorarioExito?: string;
  mensajeHorarioError?: string;

  loadingDaily = false;
  loadingWeekly = false;
  loadingList = false;
  loadingStats = false;
  updating = new Set<number>();
  cargandoPacientes = false;
  guardandoCita = false;
  mensajeCitaExito?: string;
  mensajeCitaError?: string;
  citaForm: FormGroup;
  pacientes: Paciente[] = [];
  private readonly instruccionesCamposCita: Record<string, string> = {
    pacienteId: 'Paciente existente: selecciona un paciente de la lista desplegable.',
    'nuevoPaciente.cedula': 'Cédula del nuevo paciente: ingresa 10 dígitos numéricos sin espacios.',
    'nuevoPaciente.nombres': 'Nombres del nuevo paciente: escribe los nombres completos.',
    'nuevoPaciente.apellidos': 'Apellidos del nuevo paciente: escribe los apellidos completos.',
    'nuevoPaciente.fechaNacimiento': 'Fecha de nacimiento: selecciona una fecha válida en formato AAAA-MM-DD.',
    'nuevoPaciente.genero': 'Género del nuevo paciente: elige una opción disponible.',
    'nuevoPaciente.telefono': 'Teléfono del nuevo paciente: registra un número de contacto de 10 dígitos.',
    fecha: 'Fecha de la cita: selecciona el día en formato AAAA-MM-DD.',
    horaInicio: 'Hora de inicio: elige la hora de inicio en formato 24 horas HH:MM.',
    horaFin: 'Hora de fin: especifica una hora de finalización posterior a la hora de inicio en formato HH:MM.'
  };

  private readonly destroy$ = new Subject<void>();
  constructor(
    private readonly citasService: CitasService,
    private readonly fb: FormBuilder,
    private readonly pacientesService: PacientesService,
    private readonly horariosService: HorariosService
  ) {
    this.citaForm = this.crearFormularioCita();
    this.horarioForm = this.fb.group({
      inicioAtencion: ['', Validators.required],
      finAtencion: ['', Validators.required],
      inicioFeriado: [''],
      finFeriado: ['']
    });
  }

  ngOnInit(): void {
    this.cargarPacientes();
    this.cargarHorarios();
    this.refreshAll();
    interval(30000)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.loadDailyAppointments(false);
        this.loadDailyStats(false);
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get selectedDateLabel(): string {
    const label = this.selectedDate.toLocaleDateString('es-ES', {
      weekday: 'long',
      day: 'numeric',
      month: 'long'
    });
    return label.charAt(0).toUpperCase() + label.slice(1);
  }

  get weekRangeLabel(): string {
    const start = this.getWeekStart(this.selectedDate);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);

    const startLabel = start.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short'
    });
    const endLabel = end.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short'
    });

    return `${startLabel} - ${endLabel}`;
  }

  get modoPaciente(): ModoPaciente {
    return this.citaForm.get('modoPaciente')?.value as ModoPaciente;
  }

  get nuevoPacienteForm(): FormGroup {
    return this.citaForm.get('nuevoPaciente') as FormGroup;
  }

  setView(view: VistaCitas): void {
    if (this.view === view) {
      return;
    }

    this.view = view;

    if (view === 'agenda') {
      this.loadDailyAppointments(true);
      this.loadDailyStats(true);
    } else if (view === 'semana') {
      this.loadWeeklyAppointments(true);
    } else {
      this.loadAllAppointments(true);
    }
  }

  changeDay(offset: number): void {
    const nextDate = new Date(this.selectedDate);
    nextDate.setDate(this.selectedDate.getDate() + offset);
    this.selectedDate = nextDate;
    this.selectedDateInput = this.toDateString(this.selectedDate);
    this.citaForm.get('fecha')?.setValue(this.selectedDateInput);
    this.citaForm.get('horaInicio')?.setValue('', { emitEvent: false });
    this.citaForm.get('horaFin')?.setValue('', { emitEvent: false });
    this.availableSlots = [];
    this.loadDailyAppointments(true);
    this.loadDailyStats(true);
    this.loadWeeklyAppointments(false);
  }

  onDateInputChange(value: string): void {
    if (!value) {
      return;
    }

    this.selectedDate = new Date(`${value}T00:00:00`);
    this.selectedDateInput = value;
    this.citaForm.get('fecha')?.setValue(this.selectedDateInput);
    this.citaForm.get('horaInicio')?.setValue('', { emitEvent: false });
    this.citaForm.get('horaFin')?.setValue('', { emitEvent: false });
    this.availableSlots = [];
    this.loadDailyAppointments(true);
    this.loadDailyStats(true);
    this.loadWeeklyAppointments(false);
  }

  loadDailyAppointments(showLoader = true): void {
    if (showLoader) {
      this.loadingDaily = true;
    }

    const date = this.toDateString(this.selectedDate);
    this.citasService.getDaily(date).subscribe({
      next: citas => {
        this.dailyAppointments = citas;
        this.loadingDaily = false;
        this.updateAvailableSlots(citas);
      },
      error: error => {
        console.error('No se pudieron cargar las citas del día', error);
        this.loadingDaily = false;
        this.availableSlots = [];
      }
    });
  }

  loadWeeklyAppointments(showLoader = true): void {
    if (showLoader) {
      this.loadingWeekly = true;
    }

    const start = this.toDateString(this.getWeekStart(this.selectedDate));
    this.citasService.getWeekly(start).subscribe({
      next: agenda => {
        this.weeklyAgenda = agenda;
        this.loadingWeekly = false;
      },
      error: error => {
        console.error('No se pudo cargar la agenda semanal', error);
        this.loadingWeekly = false;
      }
    });
  }

  loadAllAppointments(showLoader = true): void {
    if (showLoader) {
      this.loadingList = true;
    }

    this.citasService.getAll().subscribe({
      next: citas => {
        this.allAppointments = citas;
        this.loadingList = false;
      },
      error: error => {
        console.error('No se pudo cargar la lista completa de citas', error);
        this.loadingList = false;
      }
    });
  }

  loadDailyStats(showLoader = true): void {
    if (showLoader) {
      this.loadingStats = true;
    }

    const date = this.toDateString(this.selectedDate);
    this.citasService.getDailyStats(date).subscribe({
      next: stats => {
        this.stats = stats;
        this.loadingStats = false;
      },
      error: error => {
        console.error('No se pudieron cargar las estadísticas del día', error);
        this.loadingStats = false;
        this.stats = null;
      }
    });
  }

  cargarHorarios(): void {
    this.mensajeHorarioError = undefined;
    this.horariosService.obtenerHorario().subscribe({
      next: horario => {
        this.horario = {
          ...horario,
          inicioFeriado: horario.inicioFeriado ?? null,
          finFeriado: horario.finFeriado ?? null
        };
        this.horarioForm.patchValue({
          inicioAtencion: this.toDateTimeInput(this.horario.inicioAtencion),
          finAtencion: this.toDateTimeInput(this.horario.finAtencion),
          inicioFeriado: this.horario.inicioFeriado ? this.toDateTimeInput(this.horario.inicioFeriado) : '',
          finFeriado: this.horario.finFeriado ? this.toDateTimeInput(this.horario.finFeriado) : ''
        });
        this.horarioForm.markAsPristine();
        this.horarioForm.markAsUntouched();
        this.updateAvailableSlots();
      },
      error: error => {
        console.error('No se pudieron cargar el horario de atención', error);
        this.horario = undefined;
        const ahora = new Date();
        const inicioDefault = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), 8, 0, 0);
        const finDefault = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), 17, 0, 0);
        this.horarioForm.reset({
          inicioAtencion: this.toDateTimeInput(inicioDefault),
          finAtencion: this.toDateTimeInput(finDefault),
          inicioFeriado: '',
          finFeriado: ''
        });
        this.horarioForm.markAsPristine();
        this.horarioForm.markAsUntouched();
        this.availableSlots = [];
        this.mensajeHorarioError = 'No se pudieron cargar el horario de atención.';
      }
    });
  }

  cargarPacientes(seleccionarId?: number): void {
    this.cargandoPacientes = true;
    const pacienteActual = this.citaForm?.get('pacienteId')?.value as number | null;

    this.pacientesService.obtenerTodos()
      .pipe(finalize(() => (this.cargandoPacientes = false)))
      .subscribe({
        next: pacientes => {
          this.pacientes = pacientes;
          const control = this.citaForm.get('pacienteId');
          if (seleccionarId) {
            control?.setValue(seleccionarId, { emitEvent: false });
            control?.updateValueAndValidity({ emitEvent: false });
          } else if (pacienteActual) {
            const existe = this.pacientes.some(p => (p.id ?? null) === pacienteActual);
            control?.setValue(existe ? pacienteActual : null, { emitEvent: false });
            control?.updateValueAndValidity({ emitEvent: false });
          }
        },
        error: error => {
          console.error('No se pudieron cargar los pacientes', error);
          this.pacientes = [];
        }
      });
  }

  // Programa una cita con validaciones específicas según el modo de captura de paciente
  programarCita(): void {
    this.mensajeCitaExito = undefined;
    this.mensajeCitaError = undefined;

    if (this.citaForm.invalid) {
      this.citaForm.markAllAsTouched();
      if (this.modoPaciente === 'nuevo') {
        this.nuevoPacienteForm.markAllAsTouched();
      }
      const instrucciones = this.obtenerInstruccionesCamposCita();
      alert(`Revisa la información requerida antes de registrar la cita:\n- ${instrucciones.join('\n- ')}`);
      return;
    }

    const valores = this.citaForm.getRawValue();
    if (!this.availableSlots.length) {
      this.mensajeCitaError = 'No hay horarios disponibles para la fecha seleccionada.';
      return;
    }

    if (!valores.horaInicio || !valores.horaFin) {
      this.mensajeCitaError = 'Selecciona un horario disponible para agendar la cita.';
      return;
    }

    const slotSeleccionado = this.availableSlots.find(
      slot => slot.start === valores.horaInicio && slot.end === valores.horaFin
    );

    if (!slotSeleccionado) {
      this.mensajeCitaError = 'El horario seleccionado ya no está disponible. Actualiza la lista de horarios.';
      this.updateAvailableSlots();
      return;
    }

    this.citaForm.get('horaFin')?.setValue(slotSeleccionado.end, { emitEvent: false });
    let nuevoPacienteId: number | null = null;

    this.guardandoCita = true;

    let solicitud$: Observable<Cita>;

    if (valores.modoPaciente === 'existente') {
      if (!valores.pacienteId) {
        this.guardandoCita = false;
        const instrucciones = this.obtenerInstruccionesCamposCita();
        this.mensajeCitaError = 'Selecciona un paciente válido para registrar la cita.';
        alert(`Antes de continuar debes corregir los campos obligatorios:\n- ${instrucciones.join('\n- ')}`);
        return;
      }
      solicitud$ = this.citasService.create(this.crearPayloadCita(valores.pacienteId, valores));
    } else {
      const nuevoPaciente = this.nuevoPacienteForm.getRawValue();
      const pacienteParaCrear: Paciente = {
        cedula: nuevoPaciente.cedula,
        nombres: nuevoPaciente.nombres,
        apellidos: nuevoPaciente.apellidos,
        fechaNacimiento: new Date(nuevoPaciente.fechaNacimiento),
        edad: '',
        genero: (nuevoPaciente.genero ?? 'Otro') as Paciente['genero'],
        telefono: nuevoPaciente.telefono ? nuevoPaciente.telefono : undefined,
        email: nuevoPaciente.email ? nuevoPaciente.email : undefined,
        activo: true
      };

      solicitud$ = this.pacientesService.agregarPaciente(pacienteParaCrear).pipe(
        switchMap(pacienteCreado => {
          if (!pacienteCreado.id) {
            throw new Error('No se pudo crear el paciente');
          }
          nuevoPacienteId = pacienteCreado.id;
          return this.citasService.create(this.crearPayloadCita(pacienteCreado.id, valores)).pipe(
            tap(() => this.cargarPacientes(pacienteCreado.id))
          );
        })
      );
    }

    const pacienteSeleccionActual = this.citaForm.get('pacienteId')?.value as number | null;

    solicitud$
      .pipe(finalize(() => (this.guardandoCita = false)))
      .subscribe({
        next: () => {
          const referencia = nuevoPacienteId ?? pacienteSeleccionActual ?? undefined;
          this.mensajeCitaExito = 'Cita registrada correctamente.';
          this.resetFormularioCita(referencia);
          this.refreshAll();
        },
        error: error => {
          console.error('No se pudo registrar la cita', error);
          this.mensajeCitaError = 'No se pudo registrar la cita. Intenta nuevamente.';
        }
      });
  }

  onHoraInicioSelected(value: string): void {
    if (!value) {
      this.citaForm.get('horaFin')?.setValue('', { emitEvent: false });
      return;
    }

    const slot = this.availableSlots.find(s => s.start === value);
    if (slot) {
      this.citaForm.get('horaFin')?.setValue(slot.end, { emitEvent: false });
    }
  }

  guardarHorarios(): void {
    this.mensajeHorarioExito = undefined;
    this.mensajeHorarioError = undefined;

    if (this.horarioForm.invalid) {
      this.horarioForm.markAllAsTouched();
      this.mensajeHorarioError = 'Revisa los campos del horario de atención.';
      return;
    }

    const valores = this.horarioForm.getRawValue();
    const inicioAtencion = (valores.inicioAtencion ?? '').toString().trim();
    const finAtencion = (valores.finAtencion ?? '').toString().trim();
    const inicioFeriado = (valores.inicioFeriado ?? '').toString().trim();
    const finFeriado = (valores.finFeriado ?? '').toString().trim();

    if (!inicioAtencion || !finAtencion) {
      this.mensajeHorarioError = 'Debes indicar la fecha y hora de inicio y fin de atención.';
      return;
    }

    if ((inicioFeriado && !finFeriado) || (!inicioFeriado && finFeriado)) {
      this.mensajeHorarioError = 'Para configurar un feriado debes indicar tanto la fecha inicial como la final.';
      return;
    }

    const horarioPayload: HorarioAtencionPayload = {
      inicioAtencion: this.ensureSeconds(inicioAtencion),
      finAtencion: this.ensureSeconds(finAtencion),
      inicioFeriado: inicioFeriado ? this.ensureSeconds(inicioFeriado) : null,
      finFeriado: finFeriado ? this.ensureSeconds(finFeriado) : null
    };

    this.guardandoHorarios = true;

    this.horariosService
      .guardarHorario(horarioPayload)
      .pipe(finalize(() => (this.guardandoHorarios = false)))
      .subscribe({
        next: horario => {
          this.horario = {
            ...horario,
            inicioFeriado: horario.inicioFeriado ?? null,
            finFeriado: horario.finFeriado ?? null
          };
          this.mensajeHorarioExito = 'Horario actualizado correctamente.';
          this.horarioForm.patchValue({
            inicioAtencion: this.toDateTimeInput(this.horario.inicioAtencion),
            finAtencion: this.toDateTimeInput(this.horario.finAtencion),
            inicioFeriado: this.horario.inicioFeriado ? this.toDateTimeInput(this.horario.inicioFeriado) : '',
            finFeriado: this.horario.finFeriado ? this.toDateTimeInput(this.horario.finFeriado) : ''
          });
          this.horarioForm.markAsPristine();
          this.horarioForm.markAsUntouched();
          this.updateAvailableSlots();
        },
        error: error => {
          console.error('No se pudo guardar el horario de atención', error);
          this.mensajeHorarioError = 'No se pudo guardar el horario de atención. Intenta nuevamente.';
        }
      });
  }

  get horarioResumen(): string | null {
    const inicio = this.parseDateTimeControlValue('inicioAtencion');
    const fin = this.parseDateTimeControlValue('finAtencion');

    if (!inicio || !fin) {
      return null;
    }

    const inicioLabel = this.formatDateTimeDisplay(inicio);
    const finLabel = this.formatDateTimeDisplay(fin);

    let resumen = `El consultorio atiende en horario recorrido desde ${inicioLabel} hasta ${finLabel}.`;

    const inicioFeriado = this.parseDateTimeControlValue('inicioFeriado');
    const finFeriado = this.parseDateTimeControlValue('finFeriado');

    if (inicioFeriado && finFeriado) {
      resumen += ` Durante el feriado no habrá atención desde ${this.formatDateTimeDisplay(inicioFeriado)} hasta ${this.formatDateTimeDisplay(finFeriado)}.`;
    }

    return resumen;
  }

  get inicioAtencionDetalle(): string | null {
    return this.getHorarioDetalle('inicioAtencion');
  }

  get finAtencionDetalle(): string | null {
    return this.getHorarioDetalle('finAtencion');
  }

  get inicioFeriadoDetalle(): string | null {
    return this.getHorarioDetalle('inicioFeriado');
  }

  get finFeriadoDetalle(): string | null {
    return this.getHorarioDetalle('finFeriado');
  }

  executeAction(cita: Cita, action: QuickAction): void {
    this.updating.add(cita.citaId);
    this.citasService.updateEstado(cita.citaId, action.estado).subscribe({
      next: () => {
        this.updating.delete(cita.citaId);
        this.loadDailyAppointments(false);
        this.loadWeeklyAppointments(false);
        this.loadAllAppointments(false);
        this.loadDailyStats(false);
      },
      error: error => {
        console.error('No se pudo actualizar el estado de la cita', error);
        this.updating.delete(cita.citaId);
      }
    });
  }

  eliminarCita(cita: Cita): void {
    const pacienteLabel = cita.pacienteNombre || `Paciente #${cita.pacienteId}`;
    const confirmado = confirm(
      `¿Deseas eliminar la cita programada para las ${cita.horaInicio} del paciente ${pacienteLabel}?`
    );

    if (!confirmado) {
      return;
    }

    this.updating.add(cita.citaId);
    this.citasService.delete(cita.citaId).subscribe({
      next: () => {
        this.updating.delete(cita.citaId);
        this.mensajeCitaExito = 'Cita eliminada correctamente.';
        this.refreshAll();
      },
      error: error => {
        console.error('No se pudo eliminar la cita', error);
        this.mensajeCitaError = 'No se pudo eliminar la cita. Intenta nuevamente.';
        this.updating.delete(cita.citaId);
      }
    });
  }

  getActions(cita: Cita): QuickAction[] {
    switch (cita.estado) {
      case 'Programada':
        return [
          { label: 'Confirmar', estado: 'Confirmada', icon: 'fa-circle-check', theme: 'primary' }
        ];
      case 'Confirmada':
        return [
          { label: 'Iniciar', estado: 'EnCurso', icon: 'fa-play', theme: 'warning' }
        ];
      case 'EnCurso':
        return [
          { label: 'Completar', estado: 'Completada', icon: 'fa-flag-checkered', theme: 'success' }
        ];
      default:
        return [];
    }
  }

  getEstadoClase(estado: EstadoCita): string {
    switch (estado) {
      case 'Programada':
        return 'badge--programada';
      case 'Confirmada':
        return 'badge--confirmada';
      case 'EnCurso':
        return 'badge--encurso';
      case 'Completada':
        return 'badge--completada';
      default:
        return '';
    }
  }

  isUpdating(citaId: number): boolean {
    return this.updating.has(citaId);
  }

  trackByCita(_index: number, cita: Cita): number {
    return cita.citaId;
  }

  getDisponibilidadTexto(): string {
    if (!this.stats) {
      return 'Sin datos de disponibilidad';
    }

    const porcentaje = this.stats.total === 0 ? 0 : Math.round((this.stats.completadas / this.stats.total) * 100);
    return `${this.stats.horasDisponibles.toFixed(1)}h disponibles • ${porcentaje}% completadas`;
  }

  private crearFormularioCita(): FormGroup {
    const form = this.fb.group({
      modoPaciente: ['existente' as ModoPaciente, Validators.required],
      pacienteId: [null],
      fecha: [this.selectedDateInput, Validators.required],
      horaInicio: ['', Validators.required],
      horaFin: ['', Validators.required],
      motivo: ['', [Validators.maxLength(200)]],
      notas: ['', [Validators.maxLength(500)]],
      nuevoPaciente: this.fb.group({
        cedula: [''],
        nombres: [''],
        apellidos: [''],
        fechaNacimiento: [''],
        genero: [''],
        telefono: [''],
        email: ['', Validators.email]
      })
    });

    this.configurarValidadoresPaciente(form, 'existente');

    form.get('horaFin')?.disable({ emitEvent: false });

    form.get('modoPaciente')?.valueChanges.subscribe(modo => {
      const valor = (modo ?? 'existente') as ModoPaciente;
      this.configurarValidadoresPaciente(form, valor);
    });

    return form;
  }

  private configurarValidadoresPaciente(form: FormGroup, modo: ModoPaciente): void {
    const pacienteIdControl = form.get('pacienteId');
    const nuevoPacienteGroup = form.get('nuevoPaciente') as FormGroup;

    if (modo === 'existente') {
      pacienteIdControl?.setValidators([Validators.required]);
      pacienteIdControl?.updateValueAndValidity({ emitEvent: false });

      nuevoPacienteGroup.reset({
        cedula: '',
        nombres: '',
        apellidos: '',
        fechaNacimiento: '',
        genero: '',
        telefono: '',
        email: ''
      }, { emitEvent: false });

      ['cedula', 'nombres', 'apellidos', 'fechaNacimiento', 'genero', 'telefono'].forEach(campo => {
        const control = nuevoPacienteGroup.get(campo);
        control?.clearValidators();
        control?.updateValueAndValidity({ emitEvent: false });
      });

      const emailControl = nuevoPacienteGroup.get('email');
      emailControl?.setValidators([Validators.email]);
      emailControl?.updateValueAndValidity({ emitEvent: false });

      nuevoPacienteGroup.markAsPristine();
      nuevoPacienteGroup.markAsUntouched();
    } else {
      pacienteIdControl?.clearValidators();
      pacienteIdControl?.setValue(null, { emitEvent: false });
      pacienteIdControl?.updateValueAndValidity({ emitEvent: false });

      nuevoPacienteGroup.get('cedula')?.setValidators([Validators.required, Validators.minLength(10), Validators.maxLength(10)]);
      nuevoPacienteGroup.get('nombres')?.setValidators([Validators.required]);
      nuevoPacienteGroup.get('apellidos')?.setValidators([Validators.required]);
      nuevoPacienteGroup.get('fechaNacimiento')?.setValidators([Validators.required]);
      nuevoPacienteGroup.get('genero')?.setValidators([Validators.required]);
      nuevoPacienteGroup.get('telefono')?.setValidators([Validators.required, Validators.minLength(10), Validators.maxLength(10)]);
      const emailControl = nuevoPacienteGroup.get('email');
      emailControl?.setValidators([Validators.email]);
      Object.values(nuevoPacienteGroup.controls).forEach(control => control.updateValueAndValidity({ emitEvent: false }));
    }

    pacienteIdControl?.updateValueAndValidity({ emitEvent: false });
  }

  private resetFormularioCita(pacienteId?: number): void {
    this.citaForm.reset({
      modoPaciente: 'existente',
      pacienteId: pacienteId ?? null,
      fecha: this.selectedDateInput,
      horaInicio: '',
      horaFin: '',
      motivo: '',
      notas: '',
      nuevoPaciente: {
        cedula: '',
        nombres: '',
        apellidos: '',
        fechaNacimiento: '',
        genero: '',
        telefono: '',
        email: ''
      }
    });

    this.configurarValidadoresPaciente(this.citaForm, 'existente');
    this.citaForm.get('horaFin')?.disable({ emitEvent: false });
    this.citaForm.markAsPristine();
    this.citaForm.markAsUntouched();
  }

  private crearPayloadCita(pacienteId: number, valores: any): CitaPayload {
    const motivo = (valores.motivo ?? '').toString().trim();
    const notas = (valores.notas ?? '').toString().trim();
    return {
      pacienteId: Number(pacienteId),
      fecha: valores.fecha,
      horaInicio: this.normalizarHora((valores.horaInicio ?? '').toString().trim()),
      horaFin: this.normalizarHora((valores.horaFin ?? '').toString().trim()),
      motivo: motivo || undefined,
      notas: notas || undefined
    };
  }

  private refreshAll(): void {
    this.loadDailyAppointments(true);
    this.loadWeeklyAppointments(true);
    this.loadAllAppointments(true);
    this.loadDailyStats(true);
  }

  private getWeekStart(date: Date): Date {
    const start = new Date(date);
    const day = start.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    start.setDate(start.getDate() + diff);
    return new Date(start.getFullYear(), start.getMonth(), start.getDate());
  }

  private toDateString(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  private toDateTimeInput(value: string | Date | null | undefined): string {
    if (!value) {
      return '';
    }

    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '';
    }

    const adjusted = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return adjusted.toISOString().slice(0, 16);
  }

  private ensureSeconds(value: string): string {
    if (!value) {
      return value;
    }

    return value.length === 16 ? `${value}:00` : value;
  }

  private parseDateValue(value: string | null | undefined): Date | null {
    if (!value) {
      return null;
    }

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private parseDateTimeControlValue(controlName: string): Date | null {
    const raw = (this.horarioForm.get(controlName)?.value ?? '').toString().trim();
    return this.parseDateValue(raw);
  }

  private formatDateTimeDisplay(date: Date): string {
    const fecha = date.toLocaleDateString('es-ES', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
    const hora = date.toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });

    const capitalizada = fecha.charAt(0).toUpperCase() + fecha.slice(1);
    return `${capitalizada} a las ${hora}`;
  }

  private formatDateTimeDetail(date: Date): string {
    const fecha = date.toLocaleDateString('es-ES', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
    const hora = date.toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });

    const capitalizada = fecha.charAt(0).toUpperCase() + fecha.slice(1);
    return `${capitalizada}, ${hora}`;
  }

  private getHorarioDetalle(controlName: string): string | null {
    const valor = this.parseDateTimeControlValue(controlName);
    return valor ? this.formatDateTimeDetail(valor) : null;
  }

  private startOfDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  private isSameDay(a: Date, b: Date): boolean {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }

  private formatTimeFromDate(date: Date): string {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  private estaEnFeriado(dia: Date): boolean {
    if (!this.horario?.inicioFeriado || !this.horario?.finFeriado) {
      return false;
    }

    const inicio = this.parseDateValue(this.horario.inicioFeriado);
    const fin = this.parseDateValue(this.horario.finFeriado);

    if (!inicio || !fin) {
      return false;
    }

    const objetivo = this.startOfDay(dia);
    const inicioFeriado = this.startOfDay(inicio);
    const finFeriado = this.startOfDay(fin);

    return objetivo.getTime() >= inicioFeriado.getTime() && objetivo.getTime() <= finFeriado.getTime();
  }

  private calculateAvailableSlots(citas: Cita[]): { start: string; end: string }[] {
    const rango = this.obtenerRangoParaDia(this.selectedDate);
    if (!rango) {
      return [];
    }

    const ocupados = new Set<number>();
    citas.forEach(cita => {
      const inicio = this.toMinutes(cita.horaInicio);
      const fin = this.toMinutes(cita.horaFin);
      for (let cursor = inicio; cursor < fin; cursor += 30) {
        ocupados.add(cursor);
      }
    });

    const slots: { start: string; end: string }[] = [];
    const inicio = this.toMinutes(rango.horaInicio);
    const fin = this.toMinutes(rango.horaFin);

    for (let cursor = inicio; cursor <= fin - 30; cursor += 30) {
      if (ocupados.has(cursor)) {
        continue;
      }

      const finSlot = cursor + 30;
      slots.push({ start: this.toTime(cursor), end: this.toTime(finSlot) });
    }

    return slots;
  }

  private updateAvailableSlots(citas: Cita[] = this.dailyAppointments): void {
    const slots = this.calculateAvailableSlots(citas);
    this.availableSlots = slots;

    const horaInicioControl = this.citaForm.get('horaInicio');
    const horaFinControl = this.citaForm.get('horaFin');
    const seleccionado = (horaInicioControl?.value as string) ?? '';

    if (seleccionado) {
      const slot = slots.find(item => item.start === seleccionado);
      if (slot) {
        horaFinControl?.setValue(slot.end, { emitEvent: false });
      } else {
        horaInicioControl?.setValue('', { emitEvent: false });
        horaFinControl?.setValue('', { emitEvent: false });
      }
    }
  }

  private obtenerRangoParaDia(date: Date): { horaInicio: string; horaFin: string } | null {
    if (!this.horario) {
      return null;
    }

    const inicioAtencion = this.parseDateValue(this.horario.inicioAtencion);
    const finAtencion = this.parseDateValue(this.horario.finAtencion);

    if (!inicioAtencion || !finAtencion) {
      return null;
    }

    const dia = this.startOfDay(date);
    const diaInicio = this.startOfDay(inicioAtencion);
    const diaFin = this.startOfDay(finAtencion);

    if (dia.getTime() < diaInicio.getTime() || dia.getTime() > diaFin.getTime()) {
      return null;
    }

    if (this.estaEnFeriado(dia)) {
      return null;
    }

    let horaInicio = this.formatTimeFromDate(inicioAtencion);
    let horaFin = this.formatTimeFromDate(finAtencion);

    if (this.isSameDay(diaInicio, diaFin)) {
      if (!this.isSameDay(dia, diaInicio)) {
        return null;
      }
    } else {
      if (!this.isSameDay(dia, diaInicio)) {
        horaInicio = this.formatTimeFromDate(inicioAtencion);
      }

      if (!this.isSameDay(dia, diaFin)) {
        horaFin = this.formatTimeFromDate(finAtencion);
      }
    }

    if (this.toMinutes(horaFin) <= this.toMinutes(horaInicio)) {
      return null;
    }

    return {
      horaInicio: this.normalizarHora(horaInicio),
      horaFin: this.normalizarHora(horaFin)
    };
  }

  private normalizarHora(time: string): string {
    if (!time) {
      return '';
    }

    const parts = time.split(':');
    const hours = (parts[0] ?? '00').padStart(2, '0');
    const minutes = (parts[1] ?? '00').padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  private toMinutes(time: string): number {
    if (!time) {
      return 0;
    }

    const parts = time.split(':');
    const hours = Number(parts[0] ?? 0);
    const minutes = Number(parts[1] ?? 0);
    return hours * 60 + minutes;
  }

  private toTime(totalMinutes: number): string {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  }

  // Construye la lista de instrucciones con los campos requeridos que están inválidos
  private obtenerInstruccionesCamposCita(): string[] {
    const mensajes: string[] = [];
    const controles: Array<[string, boolean]> = [
      ['fecha', true],
      ['horaInicio', true],
      ['horaFin', true],
      ['pacienteId', this.modoPaciente === 'existente']
    ];

    controles.forEach(([path, evaluar]) => {
      if (!evaluar) {
        return;
      }
      const control = this.citaForm.get(path);
      if (control && control.invalid) {
        mensajes.push(this.instruccionesCamposCita[path] ?? 'Verifica la información ingresada.');
      }
    });

    if (this.modoPaciente === 'nuevo') {
      const camposNuevoPaciente: string[] = ['cedula', 'nombres', 'apellidos', 'fechaNacimiento', 'genero', 'telefono'];
      camposNuevoPaciente.forEach(campo => {
        const control = this.nuevoPacienteForm.get(campo);
        const clave = `nuevoPaciente.${campo}`;
        if (control && control.invalid) {
          mensajes.push(this.instruccionesCamposCita[clave] ?? 'Completa la información del nuevo paciente.');
        }
      });
    }

    return mensajes.length ? mensajes : ['Verifica los campos resaltados en rojo.'];
  }
}

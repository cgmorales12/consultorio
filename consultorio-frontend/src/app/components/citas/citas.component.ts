import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable, Subject, interval } from 'rxjs';
import { finalize, switchMap, takeUntil, tap } from 'rxjs/operators';
import { AgendaSemanalDia, Cita, CitaPayload, DailyStats, EstadoCita } from '../../models/cita.model';
import { CitasService } from '../../services/citas.service';
import { PacientesService } from '../../services/pacientes.service';
import { Paciente } from '../../models/paciente.model';

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
  private readonly workRanges = [
    { start: '08:00', end: '11:30' },
    { start: '14:00', end: '17:30' }
  ];

  constructor(
    private readonly citasService: CitasService,
    private readonly fb: FormBuilder,
    private readonly pacientesService: PacientesService
  ) {
    this.citaForm = this.crearFormularioCita();
  }

  ngOnInit(): void {
    this.cargarPacientes();
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
        this.availableSlots = this.calculateAvailableSlots(citas);
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
    this.citaForm.markAsPristine();
    this.citaForm.markAsUntouched();
  }

  private crearPayloadCita(pacienteId: number, valores: any): CitaPayload {
    const motivo = (valores.motivo ?? '').toString().trim();
    const notas = (valores.notas ?? '').toString().trim();
    return {
      pacienteId: Number(pacienteId),
      fecha: valores.fecha,
      horaInicio: (valores.horaInicio ?? '').toString().trim(),
      horaFin: (valores.horaFin ?? '').toString().trim(),
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

  private calculateAvailableSlots(citas: Cita[]): { start: string; end: string }[] {
    if (!citas.length) {
      return this.workRanges.map(range => ({ ...range }));
    }

    const sorted = [...citas].sort((a, b) => this.toMinutes(a.horaInicio) - this.toMinutes(b.horaInicio));
    const slots: { start: string; end: string }[] = [];

    for (const range of this.workRanges) {
      const rangeStart = this.toMinutes(range.start);
      const rangeEnd = this.toMinutes(range.end);
      let cursor = rangeStart;

      for (const cita of sorted) {
        const citaStart = this.toMinutes(cita.horaInicio);
        const citaEnd = this.toMinutes(cita.horaFin);

        if (citaEnd <= rangeStart || citaStart >= rangeEnd) {
          continue;
        }

        if (citaStart > cursor) {
          const libreInicio = this.toTime(cursor);
          const libreFin = this.toTime(Math.min(citaStart, rangeEnd));
          if (libreInicio !== libreFin) {
            slots.push({ start: libreInicio, end: libreFin });
          }
        }

        cursor = Math.max(cursor, Math.min(citaEnd, rangeEnd));
      }

      if (cursor < rangeEnd) {
        slots.push({ start: this.toTime(cursor), end: this.toTime(rangeEnd) });
      }
    }

    return slots.filter(slot => slot.start !== slot.end);
  }

  private toMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + (minutes || 0);
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

import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subject, interval } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { AgendaSemanalDia, Cita, DailyStats, EstadoCita } from '../../models/cita.model';
import { CitasService } from '../../services/citas.service';

type VistaCitas = 'agenda' | 'semana' | 'lista';

type QuickAction = {
  label: string;
  estado: EstadoCita;
  icon: string;
  theme: 'primary' | 'success' | 'warning';
};

@Component({
  selector: 'app-citas',
  standalone: true,
  imports: [CommonModule],
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

  private readonly destroy$ = new Subject<void>();
  private readonly workRanges = [
    { start: '08:00', end: '11:30' },
    { start: '14:00', end: '17:30' }
  ];

  constructor(private readonly citasService: CitasService) {}

  ngOnInit(): void {
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
}

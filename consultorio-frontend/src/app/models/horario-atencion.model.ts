export interface HorarioAtencion {
  horarioAtencionId: number;
  inicioAtencion: string;
  finAtencion: string;
  inicioFeriado?: string | null;
  finFeriado?: string | null;
}

export interface HorarioAtencionPayload {
  inicioAtencion: string;
  finAtencion: string;
  inicioFeriado?: string | null;
  finFeriado?: string | null;
}

export interface ActualizarHorarioRequest {
  horario: HorarioAtencionPayload;
}

export interface HorarioAtencion {
  horarioAtencionId: number;
  diaSemana: number;
  horaInicio: string;
  horaFin: string;
  activo: boolean;
}

export interface HorarioAtencionPayload {
  diaSemana: number;
  horaInicio: string;
  horaFin: string;
  activo: boolean;
}

export interface ActualizarHorariosRequest {
  horarios: HorarioAtencionPayload[];
}

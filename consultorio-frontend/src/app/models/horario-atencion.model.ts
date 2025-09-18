export interface HorarioAtencion {
  horarioAtencionId: number;
  diaInicio: number;
  horaInicio: string;
  diaFin: number;
  horaFin: string;
}

export interface HorarioAtencionPayload {
  diaInicio: number;
  horaInicio: string;
  diaFin: number;
  horaFin: string;
}

export interface ActualizarHorarioRequest {
  horario: HorarioAtencionPayload;
}

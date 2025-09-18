import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ActualizarHorarioRequest, HorarioAtencion, HorarioAtencionPayload } from '../models/horario-atencion.model';

@Injectable({ providedIn: 'root' })
export class HorariosService {
  private readonly baseUrl = 'http://localhost:5005/api/horariosatencion';

  constructor(private readonly http: HttpClient) {}

  obtenerHorario(): Observable<HorarioAtencion> {
    return this.http.get<HorarioAtencion>(this.baseUrl);
  }

  guardarHorario(horario: HorarioAtencionPayload): Observable<HorarioAtencion> {
    const payload: ActualizarHorarioRequest = { horario };
    return this.http.put<HorarioAtencion>(this.baseUrl, payload);
  }
}

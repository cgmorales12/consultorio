using System;

namespace ConsultorioMedico.API.Models.Dtos
{
    public class HorarioAtencionDto
    {
        public int HorarioAtencionId { get; set; }

        public DateTime InicioAtencion { get; set; }

        public DateTime FinAtencion { get; set; }

        public DateTime? InicioFeriado { get; set; }

        public DateTime? FinFeriado { get; set; }
    }
}

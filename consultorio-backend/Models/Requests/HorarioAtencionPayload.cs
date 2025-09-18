using System;
using System.ComponentModel.DataAnnotations;

namespace ConsultorioMedico.API.Models.Requests
{
    public class HorarioAtencionPayload
    {
        [Required]
        [Required]
        public DateTime InicioAtencion { get; set; }

        [Required]
        public DateTime FinAtencion { get; set; }

        public DateTime? InicioFeriado { get; set; }

        public DateTime? FinFeriado { get; set; }
    }

    public class ActualizarHorarioAtencionRequest
    {
        [Required]
        public HorarioAtencionPayload Horario { get; set; } = new();
    }
}

using System.ComponentModel.DataAnnotations;

namespace ConsultorioMedico.API.Models.Requests
{
    public class HorarioAtencionPayload
    {
        [Required]
        [Range(0, 6)]
        public int DiaInicio { get; set; }

        [Required]
        [RegularExpression(@"^\d{1,2}:\d{2}(:\d{2})?$", ErrorMessage = "La hora debe tener formato HH:mm o HH:mm:ss")]
        public string HoraInicio { get; set; } = string.Empty;

        [Required]
        [Range(0, 6)]
        public int DiaFin { get; set; }

        [Required]
        [RegularExpression(@"^\d{1,2}:\d{2}(:\d{2})?$", ErrorMessage = "La hora debe tener formato HH:mm o HH:mm:ss")]
        public string HoraFin { get; set; } = string.Empty;
    }

    public class ActualizarHorarioAtencionRequest
    {
        [Required]
        public HorarioAtencionPayload Horario { get; set; } = new();
    }
}

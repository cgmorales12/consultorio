using System.ComponentModel.DataAnnotations;

namespace ConsultorioMedico.API.Models.Requests
{
    public class HorarioAtencionPayload
    {
        [Required]
        [Range(0, 6)]
        public int DiaSemana { get; set; }

        [Required]
        [RegularExpression(@"^\d{1,2}:\d{2}(:\d{2})?$", ErrorMessage = "La hora debe tener formato HH:mm o HH:mm:ss")]
        public string HoraInicio { get; set; } = string.Empty;

        [Required]
        [RegularExpression(@"^\d{1,2}:\d{2}(:\d{2})?$", ErrorMessage = "La hora debe tener formato HH:mm o HH:mm:ss")]
        public string HoraFin { get; set; } = string.Empty;

        public bool Activo { get; set; } = true;
    }

    public class ActualizarHorariosAtencionRequest
    {
        [Required]
        [MinLength(1, ErrorMessage = "Debe proporcionar al menos un horario.")]
        public List<HorarioAtencionPayload> Horarios { get; set; } = new();
    }
}

namespace ConsultorioMedico.API.Models.Dtos
{
    public class HorarioAtencionDto
    {
        public int HorarioAtencionId { get; set; }

        public DayOfWeek DiaSemana { get; set; }

        public string HoraInicio { get; set; } = string.Empty;

        public string HoraFin { get; set; } = string.Empty;

        public bool Activo { get; set; }
    }
}

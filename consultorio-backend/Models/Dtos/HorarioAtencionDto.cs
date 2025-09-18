namespace ConsultorioMedico.API.Models.Dtos
{
    public class HorarioAtencionDto
    {
        public int HorarioAtencionId { get; set; }

        public int DiaInicio { get; set; }

        public string HoraInicio { get; set; } = string.Empty;

        public int DiaFin { get; set; }

        public string HoraFin { get; set; } = string.Empty;
    }
}

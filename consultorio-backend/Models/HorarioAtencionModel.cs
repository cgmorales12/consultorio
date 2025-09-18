using System;
using System.ComponentModel.DataAnnotations;

namespace ConsultorioMedico.API.Models
{
    public class HorarioAtencionModel
    {
        [Key]
        public int HorarioAtencionId { get; set; }

        [Required]
        public DateTime InicioAtencion { get; set; }

        [Required]
        public DateTime FinAtencion { get; set; }

        public DateTime? InicioFeriado { get; set; }

        public DateTime? FinFeriado { get; set; }
    }
}

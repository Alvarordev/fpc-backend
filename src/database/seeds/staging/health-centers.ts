import type {
  HealthCenterCategory,
  PeruDepartment,
} from '../../entities/health-center.entity';

export interface HealthCenterSeed {
  name: string;
  slug: string;
  department: PeruDepartment;
  category: HealthCenterCategory;
  isActive?: boolean;
}

/**
 * Reference oncology / referral hospitals for staging marcha blanca.
 * Kept separate from the demo catalog so demo can stay smaller.
 */
export const STAGING_HEALTH_CENTERS: readonly HealthCenterSeed[] = [
  // Lima — referral hubs
  {
    name: 'Instituto Nacional de Enfermedades Neoplásicas (INEN)',
    slug: 'inen-lima',
    department: 'LIMA',
    category: 'III-1',
  },
  {
    name: 'Hospital Nacional Edgardo Rebagliati Martins',
    slug: 'rebagliati-lima',
    department: 'LIMA',
    category: 'III-1',
  },
  {
    name: 'Hospital Nacional Guillermo Almenara Irigoyen',
    slug: 'almenara-lima',
    department: 'LIMA',
    category: 'III-1',
  },
  {
    name: 'Hospital Nacional Arzobispo Loayza',
    slug: 'loayza-lima',
    department: 'LIMA',
    category: 'III-1',
  },
  {
    name: 'Hospital Nacional Dos de Mayo',
    slug: 'dos-de-mayo-lima',
    department: 'LIMA',
    category: 'III-1',
  },
  {
    name: 'Instituto Nacional de Salud del Niño San Borja',
    slug: 'insn-san-borja-lima',
    department: 'LIMA',
    category: 'III-1',
  },
  {
    name: 'Instituto Nacional de Salud del Niño Breña',
    slug: 'insn-brena-lima',
    department: 'LIMA',
    category: 'III-1',
  },
  {
    name: 'Hospital de Emergencias José Casimiro Ulloa',
    slug: 'casimiro-ulloa-lima',
    department: 'LIMA',
    category: 'III-1',
  },
  {
    name: 'Hospital Nacional Hipólito Unanue',
    slug: 'hipolito-unanue-lima',
    department: 'LIMA',
    category: 'III-1',
  },
  {
    name: 'Hospital María Auxiliadora',
    slug: 'maria-auxiliadora-lima',
    department: 'LIMA',
    category: 'III-1',
  },
  {
    name: 'Hospital Cayetano Heredia',
    slug: 'cayetano-heredia-lima',
    department: 'LIMA',
    category: 'III-1',
  },
  {
    name: 'Hospital Santa Rosa',
    slug: 'santa-rosa-lima',
    department: 'LIMA',
    category: 'II-2',
  },
  {
    name: 'Clínica Oncosalud',
    slug: 'oncosalud-lima',
    department: 'LIMA',
    category: 'III-E',
  },
  {
    name: 'Clínica Internacional San Borja',
    slug: 'clinica-internacional-lima',
    department: 'LIMA',
    category: 'III-E',
  },
  // Callao
  {
    name: 'Hospital Nacional Alberto Sabogal Sologuren',
    slug: 'sabogal-callao',
    department: 'CALLAO',
    category: 'III-1',
  },
  {
    name: 'Hospital Nacional Daniel Alcides Carrión',
    slug: 'carrion-callao',
    department: 'CALLAO',
    category: 'III-1',
  },
  // Arequipa
  {
    name: 'Instituto Regional de Enfermedades Neoplásicas del Sur',
    slug: 'iren-sur-arequipa',
    department: 'AREQUIPA',
    category: 'III-1',
  },
  {
    name: 'Hospital Goyeneche',
    slug: 'goyeneche-arequipa',
    department: 'AREQUIPA',
    category: 'II-2',
  },
  {
    name: 'Hospital Regional Honorio Delgado Espinoza',
    slug: 'honorio-delgado-arequipa',
    department: 'AREQUIPA',
    category: 'III-1',
  },
  // Norte
  {
    name: 'Instituto Regional de Enfermedades Neoplásicas del Norte',
    slug: 'iren-norte-la-libertad',
    department: 'LA_LIBERTAD',
    category: 'III-1',
  },
  {
    name: 'Hospital Regional Docente de Trujillo',
    slug: 'regional-trujillo-la-libertad',
    department: 'LA_LIBERTAD',
    category: 'II-2',
  },
  {
    name: 'Hospital Belén de Trujillo',
    slug: 'belen-trujillo',
    department: 'LA_LIBERTAD',
    category: 'II-2',
  },
  {
    name: 'Hospital Regional Lambayeque',
    slug: 'regional-lambayeque',
    department: 'LAMBAYEQUE',
    category: 'II-2',
  },
  {
    name: 'Hospital Almanzor Aguinaga Asenjo',
    slug: 'almanzor-aguinaga-lambayeque',
    department: 'LAMBAYEQUE',
    category: 'III-1',
  },
  {
    name: 'Hospital Regional José Cayetano Heredia',
    slug: 'cayetano-heredia-piura',
    department: 'PIURA',
    category: 'II-2',
  },
  {
    name: 'Hospital Santa Rosa de Piura',
    slug: 'santa-rosa-piura',
    department: 'PIURA',
    category: 'II-1',
  },
  {
    name: 'Hospital Regional de Tumbes',
    slug: 'regional-tumbes',
    department: 'TUMBES',
    category: 'II-1',
  },
  {
    name: 'Hospital Regional de Cajamarca',
    slug: 'regional-cajamarca',
    department: 'CAJAMARCA',
    category: 'II-2',
  },
  // Centro / Sur Andino
  {
    name: 'Hospital Regional del Cusco',
    slug: 'regional-cusco',
    department: 'CUSCO',
    category: 'II-2',
  },
  {
    name: 'Hospital Antonio Lorena',
    slug: 'antonio-lorena-cusco',
    department: 'CUSCO',
    category: 'II-1',
  },
  {
    name: 'Hospital Regional Docente Clínico Quirúrgico Daniel Alcides Carrión',
    slug: 'regional-huancayo-junin',
    department: 'JUNIN',
    category: 'II-2',
  },
  {
    name: 'Hospital El Carmen de Huancayo',
    slug: 'el-carmen-huancayo',
    department: 'JUNIN',
    category: 'II-1',
  },
  {
    name: 'Hospital Víctor Ramos Guardia',
    slug: 'ramos-guardia-ancash',
    department: 'ANCASH',
    category: 'II-2',
  },
  {
    name: 'Hospital Regional Eleazar Guzmán Barrón',
    slug: 'eleazar-guzman-ancash',
    department: 'ANCASH',
    category: 'II-1',
  },
  {
    name: 'Hospital Regional de Ayacucho',
    slug: 'regional-ayacucho',
    department: 'AYACUCHO',
    category: 'II-2',
  },
  {
    name: 'Hospital Regional de Huancavelica',
    slug: 'regional-huancavelica',
    department: 'HUANCAVELICA',
    category: 'II-1',
  },
  {
    name: 'Hospital Regional de Apurímac',
    slug: 'regional-apurimac',
    department: 'APURIMAC',
    category: 'II-1',
  },
  {
    name: 'Hospital Regional Manuel Núñez Butrón',
    slug: 'nunez-butron-puno',
    department: 'PUNO',
    category: 'II-2',
  },
  {
    name: 'Hospital Carlos Monge Medrano',
    slug: 'carlos-monge-puno',
    department: 'PUNO',
    category: 'II-1',
  },
  // Oriente / Costa sur
  {
    name: 'Hospital Regional de Loreto',
    slug: 'regional-loreto',
    department: 'LORETO',
    category: 'II-2',
  },
  {
    name: 'Hospital Regional de Ucayali',
    slug: 'regional-ucayali',
    department: 'UCAYALI',
    category: 'II-1',
  },
  {
    name: 'Hospital Santa Rosa de Puerto Maldonado',
    slug: 'santa-rosa-madre-de-dios',
    department: 'MADRE_DE_DIOS',
    category: 'II-1',
  },
  {
    name: 'Hospital Regional de San Martín',
    slug: 'regional-san-martin',
    department: 'SAN_MARTIN',
    category: 'II-2',
  },
  {
    name: 'Hospital Regional de Amazonas',
    slug: 'regional-amazonas',
    department: 'AMAZONAS',
    category: 'II-1',
  },
  {
    name: 'Hospital Regional de Ica',
    slug: 'regional-ica',
    department: 'ICA',
    category: 'II-2',
  },
  {
    name: 'Hospital Santa María del Socorro',
    slug: 'santa-maria-socorro-ica',
    department: 'ICA',
    category: 'II-1',
  },
  {
    name: 'Hospital Hipólito Unanue de Tacna',
    slug: 'hipolito-unanue-tacna',
    department: 'TACNA',
    category: 'II-2',
  },
  {
    name: 'Hospital Regional de Moquegua',
    slug: 'regional-moquegua',
    department: 'MOQUEGUA',
    category: 'II-1',
  },
  {
    name: 'Hospital Daniel Alcides Carrión de Pasco',
    slug: 'carrion-pasco',
    department: 'PASCO',
    category: 'II-1',
  },
  {
    name: 'Hospital Regional Hermilio Valdizán',
    slug: 'hermilio-valdizan-huanuco',
    department: 'HUANUCO',
    category: 'II-2',
  },
];

import { Lang } from '../services/i18n.service';
import { RegionId } from './region.types';

/**
 * Estado de soporte de una administración educativa.
 *
 * - `stable`: verificada de principio a fin, con directorio de centros propio.
 * - `beta`: funciona sobre documentos reales, pero con alguna limitación.
 * - `manual-only`: el listado se parsea bien, pero su portal no deja
 *   descargarlo automáticamente; el docente sube el PDF a mano.
 * - `pending`: todavía no soportada. La nota dice qué falta.
 * - `blocked`: verificada y descartada por ahora, con un obstáculo concreto.
 */
export type CoverageStatus = 'stable' | 'beta' | 'manual-only' | 'pending' | 'blocked';

export interface RegionCoverage {
  /** Identificador de región, solo si está implementada. */
  id?: RegionId;
  name: Record<Lang, string>;
  status: CoverageStatus;
  /** Qué la limita o qué falta. Es lo que se muestra en la tabla. */
  note: Record<Lang, string>;
}

/**
 * Cobertura de las 17 comunidades autónomas y las 2 ciudades autónomas.
 *
 * Es la única fuente de verdad de lo que la aplicación soporta, y se muestra
 * tal cual en la portada.
 *
 * Las notas describen lo comprobado sobre los documentos oficiales reales de
 * cada administración, no lo que cabría esperar: varias comunidades que
 * parecían sencillas resultaron publicar sus vacantes en formatos muy
 * distintos, o directamente no publicarlas. Donde todavía pone "pendiente de
 * verificar" es que no se ha abierto ningún documento suyo, y por tanto no hay
 * nada que dar por sentado.
 */
export const COVERAGE: RegionCoverage[] = [
  {
    id: 'val',
    name: { ca: 'Comunitat Valenciana', es: 'Comunitat Valenciana', eu: 'Valentziako Erkidegoa', gl: 'Comunidade Valenciana', oc: 'Comunautat Valenciana' },
    status: 'stable',
    note: {
      ca: 'Llistat de vacants en PDF i directori complet de centres amb coordenades.',
      es: 'Listado de vacantes en PDF y directorio completo de centros con coordenadas.',
      eu: 'Lanpostu hutsen zerrenda PDFan eta ikastetxeen direktorio osoa koordenadekin.',
      gl: 'Listado de vacantes en PDF e directorio completo de centros con coordenadas.',
      oc: 'Listat de vacants en PDF e directòri complet de centres dab coordenades.',
    },
  },
  {
    id: 'can',
    name: { ca: 'Canàries', es: 'Canarias', eu: 'Kanariak', gl: 'Canarias', oc: 'Canàries' },
    status: 'beta',
    note: {
      ca: "Annex de vacants inicials. Alguns centres singulars —aules hospitalàries o penitenciàries— no són al directori i es queden sense situar.",
      es: 'Anexo de vacantes iniciales. Algunos centros singulares —aulas hospitalarias o penitenciarias— no están en el directorio y se quedan sin situar.',
      eu: 'Hasierako lanpostu hutsen eranskina. Zenbait ikastetxe berezi —ospitaleko edo espetxeko gelak— ez daude direktorioan eta kokatu gabe geratzen dira.',
      gl: 'Anexo de vacantes iniciais. Algúns centros singulares —aulas hospitalarias ou penitenciarias— non están no directorio e quedan sen situar.',
      oc: "Anèxe de vacants inicials. Quauqui centres singulars —aules ospitalàries o penitenciàries— non son en directòri e demoren sense situar.",
    },
  },
  {
    id: 'clm',
    name: { ca: 'Castella-la Manxa', es: 'Castilla-La Mancha', eu: 'Gaztela-Mantxa', gl: 'Castela-A Mancha', oc: 'Castela-La Mancha' },
    status: 'beta',
    note: {
      ca: 'No publica directori de centres, així que les distàncies es calculen al nucli del municipi, no a l\'edifici.',
      es: 'No publica directorio de centros, así que las distancias se calculan al núcleo del municipio, no al edificio.',
      eu: 'Ez du ikastetxeen direktoriorik argitaratzen, beraz distantziak udalerriaren erdigunera kalkulatzen dira, ez eraikinera.',
      gl: 'Non publica directorio de centros, así que as distancias se calculan no núcleo do municipio, non no edificio.',
      oc: "Non publique directòri de centres, atau qu'es distàncies se calculen en nucli deth municipi, non en edifici.",
    },
  },
  {
    id: 'mur',
    name: { ca: 'Regió de Múrcia', es: 'Región de Murcia', eu: 'Murtziako Eskualdea', gl: 'Rexión de Murcia', oc: 'Region de Murcia' },
    status: 'manual-only',
    note: {
      ca: "Llistat de vacants per acte d'adjudicació, i centres amb coordenades del Mapa Escolar. Els llistats només es publiquen dins de cada acte, així que cal baixar-los del portal i pujar-los a mà.",
      es: 'Listado de vacantes por acto de adjudicación, y centros con coordenadas del Mapa Escolar. Los listados solo se publican dentro de cada acto, así que hay que bajarlos del portal y subirlos a mano.',
      eu: 'Esleipen-ekitaldi bakoitzeko lanpostu hutsen zerrenda, eta Eskola Maparen koordenatuak dituzten ikastetxeak. Zerrendak ekitaldi bakoitzaren barruan bakarrik argitaratzen dira, beraz ataritik jaitsi eta eskuz igo behar dira.',
      gl: 'Listado de vacantes por acto de adxudicación, e centros con coordenadas do Mapa Escolar. Os listados só se publican dentro de cada acto, así que hai que baixalos do portal e subilos a man.',
      oc: "Listat de vacants per acte d'adjudicacion, e centres dab coordenades deth Mapa Escolar. Es listats sonque se publiquen laguens de cada acte, atau que cau baishar-les deth portau e amuntar-les a man.",
    },
  },
  {
    name: { ca: 'Galícia', es: 'Galicia', eu: 'Galizia', gl: 'Galicia', oc: 'Galícia' },
    status: 'blocked',
    note: {
      ca: 'No publica llistats de vacants: només participants i destinacions ja adjudicades. La tria de plaça es fa dins d\'una aplicació web.',
      es: 'No publica listados de vacantes: solo participantes y destinos ya adjudicados. La elección de plaza ocurre dentro de una aplicación web.',
      eu: 'Ez du lanpostu hutsen zerrendarik argitaratzen: parte-hartzaileak eta jadanik esleitutako helmugak bakarrik. Lanpostuaren aukeraketa web-aplikazio baten barruan egiten da.',
      gl: 'Non publica listaxes de vacantes: só participantes e destinos xa adxudicados. A elección de praza faise dentro dunha aplicación web.',
      oc: "Non publique listats de vacants: sonque participants e destinacions ja adjudicades. Era causida de plaça se hè laguens d'ua aplicacion web.",
    },
  },
  {
    name: { ca: 'Illes Balears', es: 'Illes Balears', eu: 'Balear Uharteak', gl: 'Illas Baleares', oc: 'Islas Balears' },
    status: 'blocked',
    note: {
      ca: 'Les pàgines públiques d\'adjudicacions no contenen documents; el tràmit va per intranet amb autenticació.',
      es: 'Las páginas públicas de adjudicaciones no contienen documentos; el trámite va por intranet con autenticación.',
      eu: 'Esleipenen orrialde publikoek ez dute dokumenturik; izapidea autentifikazioa duen intranet bidez egiten da.',
      gl: 'As páxinas públicas de adxudicacións non conteñen documentos; o trámite vai por intranet con autenticación.',
      oc: "Es pagines publiques d'adjudicacions non contien documents; eth tramit se hè per intranet dab autentificacion.",
    },
  },
  {
    name: { ca: 'Andalusia', es: 'Andalucía', eu: 'Andaluzia', gl: 'Andalucía', oc: 'Andalosia' },
    status: 'blocked',
    note: {
      ca: "No publica cap document amb les vacants: només es poden consultar dins d'una aplicació web. Caldria una via d'entrada diferent de la de pujar un PDF.",
      es: 'No publica ningún documento con las vacantes: solo se pueden consultar dentro de una aplicación web. Haría falta una vía de entrada distinta a la de subir un PDF.',
      eu: 'Ez du lanpostu hutsekin dokumenturik argitaratzen: web-aplikazio baten barruan bakarrik kontsulta daitezke. PDF bat igotzeaz bestelako sarbide bat behar litzateke.',
      gl: 'Non publica ningún documento coas vacantes: só se poden consultar dentro dunha aplicación web. Faría falta unha vía de entrada distinta á de subir un PDF.',
      oc: "Non publique cap document dab es vacants: sonque se pòden consultar laguens d'ua aplicacion web. Caleria ua via d'entrada diferenta dera d'amuntar un PDF.",
    },
  },
  {
    id: 'ara',
    name: { ca: 'Aragó', es: 'Aragón', eu: 'Aragoi', gl: 'Aragón', oc: 'Aragon' },
    status: 'manual-only',
    note: {
      ca: "Fitxes de vacant amb jornada, durada i causa, i directori de centres amb coordenades. El seu servidor no presenta la cadena completa del certificat, així que no es poden descarregar els PDF automàticament: cal pujar-los a mà.",
      es: 'Fichas de vacante con jornada, duración y causa, y directorio de centros con coordenadas. Su servidor no presenta la cadena completa del certificado, así que no se pueden descargar los PDF automáticamente: hay que subirlos a mano.',
      eu: 'Lanaldia, iraupena eta arrazoia dituzten lanpostu hutsen fitxak, eta koordenatuak dituen ikastetxeen direktorioa. Bere zerbitzariak ez du ziurtagiriaren katea osorik aurkezten, beraz PDFak ezin dira automatikoki deskargatu: eskuz igo behar dira.',
      gl: 'Fichas de vacante con xornada, duración e causa, e directorio de centros con coordenadas. O seu servidor non presenta a cadea completa do certificado, así que non se poden descargar os PDF automaticamente: hai que subilos a man.',
      oc: "Fiches de vacant dab jornada, durada e causa, e directòri de centres dab coordenades. Eth sòn servidor non presente era cadia completa deth certificat, atau que non se pòden descargar es PDF automaticament: cau amuntar-les a man.",
    },
  },
  {
    id: 'ast',
    name: { ca: 'Astúries', es: 'Asturias', eu: 'Asturias', gl: 'Asturias', oc: 'Asturies' },
    status: 'beta',
    note: {
      ca: "Oferta de places de cada adjudicació setmanal, agrupada per centre i amb totes les coordenades. No cobreix l'adjudicació d'inici de curs, que Astúries no publica com a document sinó dins d'una consulta web.",
      es: 'Oferta de plazas de cada adjudicación semanal, agrupada por centro y con todas las coordenadas. No cubre la adjudicación de inicio de curso, que Asturias no publica como documento sino dentro de una consulta web.',
      eu: 'Asteroko esleipen bakoitzaren lanpostu-eskaintza, ikastetxeka multzokatua eta koordenatu guztiekin. Ez ditu ikasturte hasierako esleipena hartzen, Asturiasek ez baitu dokumentu gisa argitaratzen, web kontsulta baten barruan baizik.',
      gl: 'Oferta de prazas de cada adxudicación semanal, agrupada por centro e con todas as coordenadas. Non cobre a adxudicación de inicio de curso, que Asturias non publica como documento senón dentro dunha consulta web.',
      oc: "Aufèrta de plaças de cada adjudicacion setmanau, agropada per centre e dab totes es coordenades. Non cuerbe era adjudicacion de començament de cors, que Asturies non publique coma document senon laguens d'ua consulta web.",
    },
  },
  {
    id: 'cnt',
    name: { ca: 'Cantàbria', es: 'Cantabria', eu: 'Kantabria', gl: 'Cantabria', oc: 'Cantàbria' },
    status: 'beta',
    note: {
      ca: "Publica les vacants en obert i en un sol document, amb la taula girada com la de Múrcia. El codi del centre no té columna pròpia: va dins del codi del lloc. Les coordenades surten del cercador de centres oficial.",
      es: 'Publica las vacantes en abierto y en un solo documento, con la tabla girada como la de Murcia. El código del centro no tiene columna propia: va dentro del código del puesto. Las coordenadas salen del buscador de centros oficial.',
      eu: 'Lanpostu hutsak irekita eta dokumentu bakar batean argitaratzen ditu, Murtziakoaren antzera taula biratuta duela. Ikastetxearen kodeak ez du bere zutaberik: lanpostuaren kodearen barruan doa. Koordenatuak ikastetxeen bilatzaile ofizialetik ateratzen dira.',
      gl: 'Publica as vacantes en aberto e nun só documento, coa táboa xirada como a de Murcia. O código do centro non ten columna propia: vai dentro do código do posto. As coordenadas saen do buscador de centros oficial.',
      oc: "Publique es vacants en dubèrt e en un solet document, dab era taula virada coma era de Murcia. Eth còdi deth centre non a colomna pròpia: va laguens deth còdi deth lòc. Es coordenades vien deth cercador de centres oficiau.",
    },
  },
  {
    id: 'cyl',
    name: { ca: 'Castella i Lleó', es: 'Castilla y León', eu: 'Gaztela eta Leon', gl: 'Castela e León', oc: 'Castela e Léon' },
    status: 'beta',
    note: {
      ca: "Llistat AIVI de vacants, amb directori de centres amb coordenades.",
      es: 'Listado AIVI de vacantes, con directorio de centros con coordenadas.',
      eu: 'Lanpostu hutsen AIVI zerrenda, koordenatuak dituen ikastetxeen direktorioarekin.',
      gl: 'Listado AIVI de vacantes, con directorio de centros con coordenadas.',
      oc: "Listat AIVI de vacants, dab directòri de centres dab coordenades.",
    },
  },
  {
    name: { ca: 'Catalunya', es: 'Cataluña', eu: 'Katalunia', gl: 'Cataluña', oc: 'Catalonha' },
    status: 'blocked',
    note: {
      ca: "L'adjudicació d'estiu no publica cap llista de vacants: es demanen centres a cegues i el resultat només es veu amb identificació digital. L'únic que es publica són llistes marginals per servei territorial, cadascuna amb la seua maqueta.",
      es: 'La adjudicación de verano no publica ninguna lista de vacantes: se piden centros a ciegas y el resultado solo se ve con identificación digital. Lo único que se publica son listas marginales por servicio territorial, cada una con su maqueta.',
      eu: 'Udako esleipenak ez du lanpostu hutsen zerrendarik argitaratzen: ikastetxeak itsuan eskatzen dira eta emaitza identifikazio digitalarekin bakarrik ikusten da. Argitaratzen den bakarra lurralde-zerbitzuko zerrenda marjinalak dira, bakoitza bere formatuarekin.',
      gl: 'A adxudicación de verán non publica ningunha lista de vacantes: pídense centros a cegas e o resultado só se ve con identificación dixital. O único que se publica son listas marxinais por servizo territorial, cada unha coa súa propia maqueta.',
      oc: "Era adjudicacion d'estiu non publique cap lista de vacants: se demanen centres a cègues e eth resultat sonque se ve dab identificacion digitau. Er unic que se publique son listes marginaus per servici territoriau, cadua dab era sua pròpia maqueta.",
    },
  },
  {
    id: 'ext',
    name: { ca: 'Extremadura', es: 'Extremadura', eu: 'Extremadura', gl: 'Estremadura', oc: 'Extremadura' },
    status: 'beta',
    note: {
      ca: "Plantilla orgànica: diu quins llocs hi ha a cada centre i quants estan vacants. No és la mateixa oferta que la de les adjudicacions d'interins, que només es consulta dins de PROFEX amb identificació.",
      es: 'Plantilla orgánica: dice qué puestos hay en cada centro y cuántos están vacantes. No es la misma oferta que la de las adjudicaciones de interinos, que solo se consulta dentro de PROFEX con identificación.',
      eu: 'Plantilla organikoa: ikastetxe bakoitzean zer lanpostu dauden eta zenbat hutsik dauden esaten du. Ez da bitartekoen esleipenetako eskaintza bera, hori PROFEXen barruan bakarrik kontsultatzen baita identifikazioarekin.',
      gl: 'Cadro de persoal orgánico: di que postos hai en cada centro e cantos están vacantes. Non é a mesma oferta que a das adxudicacións de interinos, que só se consulta dentro de PROFEX con identificación.',
      oc: "Plantilla organica: ditz quini lòcs a cada centre e quanti son vacants. Non ei era madeisha aufèrta qu'era des adjudicacions d'interins, que sonque se consulte laguens de PROFEX dab identificacion.",
    },
  },
  {
    id: 'mad',
    name: { ca: 'Madrid', es: 'Madrid', eu: 'Madril', gl: 'Madrid', oc: 'Madrid' },
    status: 'beta',
    note: {
      ca: "Annex de vacants utilitzades en l'assignació, amb directori de centres complet.",
      es: 'Anexo de vacantes utilizadas en la asignación, con directorio de centros completo.',
      eu: 'Esleipenean erabilitako lanpostu hutsen eranskina, ikastetxeen direktorio osoarekin.',
      gl: 'Anexo de vacantes utilizadas na asignación, con directorio de centros completo.',
      oc: "Anèxe de vacants emplegades ena assignacion, dab directòri de centres complet.",
    },
  },
  {
    id: 'nav',
    name: { ca: 'Navarra', es: 'Navarra', eu: 'Nafarroa', gl: 'Navarra', oc: 'Navarra' },
    status: 'beta',
    note: {
      ca: "Vacants definitives en obert, en dues maquetes que es reconeixen soles. La de mestres porta codi de centre; la de secundària no, i les seues places se situen al nucli de la localitat, no a l'edifici.",
      es: 'Vacantes definitivas en abierto, en dos maquetas que se reconocen solas. La de maestros trae código de centro; la de secundaria no, y sus plazas se sitúan en el núcleo de la localidad, no en el edificio.',
      eu: 'Behin betiko lanpostu hutsak irekita, beren kabuz ezagutzen diren bi formatutan. Maisu-maistrenak ikastetxe-kodea dakar; bigarren hezkuntzakoak ez, eta bere lanpostuak herriaren erdigunean kokatzen dira, ez eraikinean.',
      gl: 'Vacantes definitivas en aberto, en dúas maquetas que se recoñecen soas. A de mestres trae código de centro; a de secundaria non, e as súas prazas sitúanse no núcleo da localidade, non no edificio.',
      oc: "Vacants definitives en dubèrt, en dues maquetes que se coneishen soletes. Era de mèstres pòrte còdi de centre; era de segondària non, e es sues plaças se situen en nucli dera localitat, non en edifici.",
    },
  },
  {
    name: { ca: 'País Basc', es: 'País Vasco', eu: 'Euskadi', gl: 'País Vasco', oc: 'País Basco' },
    status: 'blocked',
    note: {
      ca: "Les vacants només es publiquen dins de Hezigunea, amb autenticació; la pròpia resolució oficial ho diu. El directori de centres sí que és utilitzable.",
      es: 'Las vacantes solo se publican dentro de Hezigunea, con autenticación; lo dice la propia resolución oficial. El directorio de centros sí es utilizable.',
      eu: 'Lanpostu hutsak Hezigunearen barruan bakarrik argitaratzen dira, autentifikazioarekin; ebazpen ofizialak berak dio hori. Ikastetxeen direktorioa, ordea, erabilgarria da.',
      gl: 'As vacantes só se publican dentro de Hezigunea, con autenticación; a propia resolución oficial dío. O directorio de centros si é utilizable.',
      oc: "Es vacants sonque se publiquen laguens de Hezigunea, dab autentificacion; era pròpia resolucion oficiau ac ditz. Eth directòri de centres si ei utilizable.",
    },
  },
  {
    id: 'rio',
    name: { ca: 'La Rioja', es: 'La Rioja', eu: 'Errioxa', gl: 'A Rioxa', oc: 'La Rioja' },
    status: 'manual-only',
    note: {
      ca: "Un sol document recull les vacants de tots els cossos, amb columnes ben alineades, i hi ha coordenades per als centres. El seu portal, però, bloqueja les descàrregues automàtiques: el PDF s'hauria de pujar a mà.",
      es: 'Un solo documento recoge las vacantes de todos los cuerpos, con columnas bien alineadas, y hay coordenadas para los centros. Su portal, en cambio, bloquea las descargas automáticas: el PDF habría que subirlo a mano.',
      eu: 'Dokumentu bakar batek kidego guztien lanpostu hutsak biltzen ditu, zutabe ondo lerrokatuekin, eta ikastetxeentzako koordenatuak daude. Bere ataria, ordea, deskarga automatikoak blokeatzen ditu: PDFa eskuz igo beharko litzateke.',
      gl: 'Un só documento recolle as vacantes de todos os corpos, con columnas ben aliñadas, e hai coordenadas para os centros. O seu portal, en cambio, bloquea as descargas automáticas: o PDF habería que subilo a man.',
      oc: "Un solet document arreplegue es vacants de toti es còssi, dab colomnes plan alinhades, e i a coordenades entàs centres. Eth sòn portau, ça que la, blòque es descargues automatiques: eth PDF s'auré d'amuntar a man.",
    },
  },
  {
    name: { ca: 'Ceuta', es: 'Ceuta', eu: 'Ceuta', gl: 'Ceuta', oc: 'Ceuta' },
    status: 'blocked',
    note: {
      ca: "No publica les vacants enlloc: l'interí demana centres a cegues, per ordre de preferència, i només les veu dins de la seu electrònica identificant-se. L'únic document obert és l'adjudicació ja feta, amb noms.",
      es: 'No publica las vacantes en ninguna parte: el interino pide centros a ciegas, por orden de preferencia, y solo las ve dentro de la sede electrónica identificándose. El único documento abierto es la adjudicación ya hecha, con nombres.',
      eu: 'Ez ditu lanpostu hutsak inon argitaratzen: bitartekoak ikastetxeak itsuan eskatzen ditu, lehentasun-hurrenkeraren arabera, eta egoitza elektronikoaren barruan bakarrik ikusten ditu identifikatuta. Dokumentu ireki bakarra jadanik egindako esleipena da, izenekin.',
      gl: 'Non publica as vacantes en ningún sitio: o interino pide centros a cegas, por orde de preferencia, e só as ve dentro da sede electrónica identificándose. O único documento aberto é a adxudicación xa feita, con nomes.',
      oc: "Non publique es vacants en cap lòc: er interin demane centres a cègues, per orde de preferéncia, e sonque es ve laguens dera sede electronica identificant-se. Er unic document dubèrt ei era adjudicacion ja hèta, dab nòms.",
    },
  },
  {
    id: 'mel',
    name: { ca: 'Melilla', es: 'Melilla', eu: 'Melilla', gl: 'Melilla', oc: 'Melilla' },
    status: 'beta',
    note: {
      ca: "Única administració que no publica el llistat en PDF: des del curs 26-27 el dóna en full de càlcul. Com que no hi porta el codi del centre, es creua pel nom, i les coordenades surten de geocodificar els domicilis del registre estatal.",
      es: 'Única administración que no publica el listado en PDF: desde el curso 26-27 lo da en hoja de cálculo. Como no lleva el código del centro, se cruza por el nombre, y las coordenadas salen de geocodificar los domicilios del registro estatal.',
      eu: 'Zerrenda PDFan argitaratzen ez duen administrazio bakarra da: 26-27 ikasturtetik aurrera kalkulu-orri batean ematen du. Ikastetxearen kodea ez daramanez, izenaren bidez gurutzatzen da, eta koordenatuak estatuko erregistroko helbideak geokodetuz ateratzen dira.',
      gl: 'Única administración que non publica o listado en PDF: desde o curso 26-27 dao en folla de cálculo. Como non leva o código do centro, crúzase polo nome, e as coordenadas saen de xeocodificar os domicilios do rexistro estatal.',
      oc: "Unica administracion que non publique eth listat en PDF: dès eth cors 26-27 lo balhe en huelha de calcul. Coma non pòrte eth còdi deth centre, se crotze peth nòm, e es coordenades vien de geocodificar es domicilis deth registre estatau.",
    },
  },
];

/** Cuántas administraciones hay en cada estado, para el resumen de la tabla. */
export function coverageSummary(): Record<CoverageStatus, number> {
  const summary: Record<CoverageStatus, number> = {
    stable: 0,
    beta: 0,
    'manual-only': 0,
    pending: 0,
    blocked: 0,
  };
  for (const entry of COVERAGE) summary[entry.status]++;
  return summary;
}

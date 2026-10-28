import { SurveyType } from '../../database/entities/survey.entity';

export enum SurveyScriptVariant {
  DIAGNOSED = 'DIAGNOSED',
  SIGNS_AND_SYMPTOMS = 'SIGNS_AND_SYMPTOMS',
}

const RATING_QUESTION =
  'Podría indicarnos del 1 al 5, ¿cómo calificaría la atención que recibió? Siendo 5 la calificación de mayor satisfacción y 1 la de menor satisfacción.';

/** Client survey messages ("Observaciones CRM", punto 19.c). {name} is replaced. */
const ENROLLMENT_DIAGNOSED = `Buenas tardes estimada(o) {name} ✨
Muchas gracias por inscribirte al Programa SEPA de la Fundación Peruana de Cáncer ❤️
Como le comentamos en la llamada telefónica, le realizaremos una breve encuesta sobre la atención que recibió al inscribirse al Programa SEPA.
${RATING_QUESTION}
Así mismo, le invitamos a ser parte de nuestra comunidad SEPA https://whatsapp.com/channel/0029VaNFBhuHQbS5eH8osy0y
Por otro lado, invitamos a sus amigos y familiares a ser parte de nuestro canal de prevención https://whatsapp.com/channel/0029VaIIPa1Lo4hd5IclIH3P , para que puedan tener acceso a las charlas y campañas de prevención 🩺💙`;

const ENROLLMENT_SIGNS_AND_SYMPTOMS = `Buen día estimado(a) {name} ✨
¡Bienvenidx al Programa SEPA de la Fundación Peruana de Cáncer! ❤️
Como le comentamos en la llamada telefónica, le realizaremos una breve encuesta sobre la atención que recibió al inscribirse al Programa SEPA.
${RATING_QUESTION}
👨‍👩‍👦‍👦 Le invitamos a usted y a sus amigos y familiares a formar parte de nuestro canal de prevención https://whatsapp.com/channel/0029VaIIPa1Lo4hd5IclIH3P , para que pueda tener acceso a las charlas y campañas de prevención.
Mañana, en el transcurso del día, nuestra asesora se comunicará con usted 🩺💙`;

const THREE_MONTHS = `Buenas tardes estimado(a) {name} ✨ esperamos que se encuentre bien.
Es importante para nosotros conocer cómo se siente con nuestro programa, para ello, le invitamos a que pueda indicarnos del 1 al 5, ¿con cuánto calificaría la atención brindada en el programa? 🙏🏼
Nos importa seguir brindándole lo mejor de nosotros. Le agradecemos de antemano por su participación.`;

const TALK = `Buen día estimado(a) {name} ✨
Muchas gracias por participar en nuestra charla del Programa SEPA de la Fundación Peruana de Cáncer.
Podría indicarnos del 1 al 5, ¿qué tal le pareció la charla? Siendo 5 la calificación de mayor satisfacción y 1 la de menor satisfacción.
Quedamos atentos a lo que nos comente 💙`;

const PSYCHOONCOLOGY = `Buen día estimado(a) {name} ✨ esperamos que dentro de todo, se encuentre bien 🫂
¿Cómo le fue en la sesión que tuvo con la psicóloga?
Podría indicarnos del 1 al 5, ¿qué tal le pareció? Siendo 5 la calificación de mayor satisfacción y 1 la de menor satisfacción 🥹
Quedamos atentos a lo que nos comente, le deseamos que tenga un buen día.`;

export function surveyScript(
  type: SurveyType,
  variant: SurveyScriptVariant,
  name: string,
): string {
  const template =
    type === SurveyType.ENROLLMENT
      ? variant === SurveyScriptVariant.SIGNS_AND_SYMPTOMS
        ? ENROLLMENT_SIGNS_AND_SYMPTOMS
        : ENROLLMENT_DIAGNOSED
      : type === SurveyType.THREE_MONTHS
        ? THREE_MONTHS
        : type === SurveyType.TALK
          ? TALK
          : PSYCHOONCOLOGY;
  return template
    .replace('{name}', name)
    .replace(/ +([\n.])/g, '$1')
    .trim();
}

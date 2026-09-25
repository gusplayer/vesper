/**
 * Development only. Set a route here and the running app jumps to it on the next
 * launch, so any screen can be reviewed without tapping through. Null in git.
 * DEV_SESSION starts a fake session first ('running') or starts and completes one
 * ('completed'), for the session screens.
 * DEV_BLOCK_TEST is an Android package name: two seconds after launch the blocking
 * module shields it, so the shield can be checked from adb without tapping.
 * DEV_WINDOW_TEST is an Android package name: on launch a routine window is
 * registered with the OS that opens two minutes later and lasts three, so the alarms
 * can be checked with the app process dead.
 */
export const DEV_START_ROUTE: string | null = null;
export const DEV_SESSION: 'running' | 'completed' | null = null;
export const DEV_BLOCK_TEST: string | null = null;
export const DEV_WINDOW_TEST: string | null = null;
/** Marks onboarding done on launch, for driving the tabs on a fresh install. */
export const DEV_SKIP_ONBOARDING = false;
/** Creates a circle profile on launch when there is none, for reviewing circle/ screens. */
export const DEV_CIRCLE_PROFILE = false;
/**
 * The circle server this dev build talks to instead of production, e.g.
 * 'http://10.0.2.2:8787' from the Android emulator or 'http://localhost:8787' from the
 * iOS simulator, with `npm run dev` in server/ (memory, nothing kept). So a run of the
 * identity and the backup (ADR-0048) never writes to the production database.
 */
export const DEV_CIRCLE_API_URL: string | null = null;

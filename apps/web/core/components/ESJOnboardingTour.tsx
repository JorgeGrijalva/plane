import React, { useState, useEffect, startTransition, Suspense } from "react";
import * as ReactJoyride from "react-joyride";

const Joyride: any = (ReactJoyride as any).default || (ReactJoyride as any).Joyride || ReactJoyride;
const STATUS: any = (ReactJoyride as any).STATUS || { FINISHED: "finished", SKIPPED: "skipped" };

export const ESJOnboardingTour = () => {
  const [run, setRun] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    startTransition(() => {
      setIsMounted(true);
    });
    // Check if the user has already seen the tour
    const hasSeenTour = localStorage.getItem("esj_onboarding_completed");
    if (!hasSeenTour) {
      startTransition(() => {
        setRun(true);
      });
    }
  }, []);

  if (!isMounted) return null;

  const steps = [
    {
      target: "a[href$='/projects'], #tour-step-1-projects",
      content: "🏗️ Bienvenido a la División ESJ. Aquí verás tus 'Proyectos EAA' asignados.",
      disableBeacon: true,
    },
    {
      target: "a[href*='/cycles'], #tour-step-2-cycles",
      content:
        "⏱️ Fases de SAP (PEPs). Aquí agrupamos el trabajo. OJO: Las fases tienen fecha de caducidad. Entregar fuera de fecha genera una anomalía.",
    },
    {
      target: "a[href*='/issues'], #tour-step-3-issues",
      content: "🔩 Tus Productos. Estas son las piezas (Anclas, Columnas). Haz clic en una para ver sus detalles.",
    },
    {
      target: "#tour-step-4-status, [data-tour='issue-status']",
      content:
        "🛑 El Botón de Pánico (RFI). Si te falta información del cliente, cambia el estatus a '03.1 Detenido RFI'. ¡Esto congela tu cronómetro y te protege en la métrica de Horas/Ton!",
    },
  ];

  const handleJoyrideCallback = (data: any) => {
    const { status } = data;
    const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED];

    if (finishedStatuses.includes(status)) {
      startTransition(() => {
        setRun(false);
      });
      localStorage.setItem("esj_onboarding_completed", "true");
    }
  };

  return (
    <Suspense fallback={null}>
      <Joyride
        callback={handleJoyrideCallback}
        continuous
        hideCloseButton
        run={run}
        scrollToFirstStep
        showProgress
        showSkipButton
        steps={steps}
        styles={{
          options: {
            zIndex: 10000,
            primaryColor: "#0052CC",
          },
        }}
      />
    </Suspense>
  );
};

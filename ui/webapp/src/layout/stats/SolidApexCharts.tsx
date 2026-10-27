import type ApexCharts from 'apexcharts';
import type { ApexOptions } from 'apexcharts';
import { createEffect, createMemo, on, onCleanup, onMount, untrack } from 'solid-js';
import { unwrap } from 'solid-js/store';

interface Props {
  options: ApexOptions;
  series: NonNullable<ApexOptions['series']>;
  type: NonNullable<NonNullable<ApexOptions['chart']>['type']>;
  height?: string | number;
  width?: string | number;
}

export const SolidApexCharts = (props: Props) => {
  let element!: HTMLDivElement;
  let chart: ApexCharts | undefined;
  let disposed = false;
  let operation: Promise<unknown> = Promise.resolve();

  const options = createMemo<ApexOptions>(() => {
    const configured = unwrap(props.options);
    return {
      ...configured,
      chart: {
        ...configured.chart,
        type: props.type,
        height: props.height ?? configured.chart?.height ?? 'auto',
        width: props.width ?? configured.chart?.width ?? '100%',
      },
      series: unwrap(props.series),
    };
  });

  const reportError = (error: unknown) => {
    if (!disposed) {
      console.error('Unable to render or update ApexCharts', error);
    }
  };

  onMount(() => {
    operation = import('apexcharts')
      .then(async ({ default: Chart }) => {
        if (disposed) return;
        chart = new Chart(element, untrack(options));
        await chart.render();
      })
      .catch(reportError);
  });

  createEffect(
    on(
      options,
      (nextOptions) => {
        operation = operation
          .then(async () => {
            if (!disposed) await chart?.updateOptions(nextOptions);
          })
          .catch(reportError);
      },
      { defer: true }
    )
  );

  onCleanup(() => {
    disposed = true;
    // Wait for rendering or an update before releasing the chart's DOM and listeners.
    void operation.then(() => chart?.destroy()).catch(reportError);
  });

  return (
    <div
      ref={(value) => {
        element = value;
      }}
    />
  );
};

import { createSignal } from 'solid-js';
import { render } from 'solid-js/web';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SolidApexCharts } from '../SolidApexCharts';

const chart = vi.hoisted(() => ({
  create: vi.fn(),
  render: vi.fn(),
  updateOptions: vi.fn(),
  destroy: vi.fn(),
}));

vi.mock('apexcharts', () => ({
  default: class {
    constructor(element: HTMLElement, options: unknown) {
      chart.create(element, options);
    }
    render = chart.render;
    updateOptions = chart.updateOptions;
    destroy = chart.destroy;
  },
}));

const initialProps = {
  options: { chart: { fontFamily: 'Lato' }, title: { text: 'Projects' } },
  series: [{ name: 'Projects', data: [1, 2] }],
  type: 'line' as const,
  height: 250,
  width: '100%',
};

const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

describe('SolidApexCharts', () => {
  let container: HTMLDivElement;
  let dispose: (() => void) | undefined;

  beforeEach(() => {
    vi.resetAllMocks();
    chart.render.mockResolvedValue(undefined);
    chart.updateOptions.mockResolvedValue(undefined);
    container = document.createElement('div');
    document.body.appendChild(container);
    dispose = undefined;
  });

  afterEach(() => {
    dispose?.();
    document.body.replaceChildren();
  });

  it('renders the configured chart and releases it on unmount', async () => {
    dispose = render(() => <SolidApexCharts {...initialProps} />, container);

    await vi.waitFor(() => expect(chart.render).toHaveBeenCalledOnce());
    expect(chart.create).toHaveBeenCalledWith(container.firstElementChild, {
      ...initialProps.options,
      chart: { fontFamily: 'Lato', type: 'line', height: 250, width: '100%' },
      series: initialProps.series,
    });
    expect(chart.updateOptions).not.toHaveBeenCalled();

    dispose();
    dispose = undefined;
    await vi.waitFor(() => expect(chart.destroy).toHaveBeenCalledOnce());
  });

  it('updates options, series, chart type and size without creating a second chart', async () => {
    const [props, setProps] = createSignal({ ...initialProps, type: 'line' as 'line' | 'bar' });
    dispose = render(() => <SolidApexCharts {...props()} />, container);
    await vi.waitFor(() => expect(chart.render).toHaveBeenCalledOnce());

    const nextProps = {
      ...initialProps,
      options: { chart: { fontFamily: 'Arial' }, title: { text: 'Updated projects' } },
      series: [{ name: 'Projects', data: [3, 4] }],
      type: 'bar' as const,
      height: 350,
      width: '80%',
    };
    setProps(nextProps);

    await vi.waitFor(() =>
      expect(chart.updateOptions).toHaveBeenLastCalledWith({
        ...nextProps.options,
        chart: { fontFamily: 'Arial', type: 'bar', height: 350, width: '80%' },
        series: nextProps.series,
      })
    );
    expect(chart.create).toHaveBeenCalledOnce();
  });

  it('waits for the first render before applying a reactive update', async () => {
    const rendering = deferred();
    chart.render.mockReturnValueOnce(rendering.promise);
    const [series, setSeries] = createSignal(initialProps.series);
    dispose = render(() => <SolidApexCharts {...initialProps} series={series()} />, container);
    await vi.waitFor(() => expect(chart.render).toHaveBeenCalledOnce());

    const nextSeries = [{ name: 'Projects', data: [5, 6] }];
    setSeries(nextSeries);
    await Promise.resolve();
    expect(chart.updateOptions).not.toHaveBeenCalled();

    rendering.resolve();
    await vi.waitFor(() =>
      expect(chart.updateOptions).toHaveBeenCalledWith(expect.objectContaining({ series: nextSeries }))
    );
  });

  it('does not create a chart when unmounted while the module is loading', async () => {
    dispose = render(() => <SolidApexCharts {...initialProps} />, container);
    dispose();
    dispose = undefined;

    await import('apexcharts');
    await Promise.resolve();
    expect(chart.create).not.toHaveBeenCalled();
    expect(chart.destroy).not.toHaveBeenCalled();
  });

  it('finishes an in-flight update before destroying the chart and skips queued updates', async () => {
    const updating = deferred();
    chart.updateOptions.mockReturnValueOnce(updating.promise);
    const [series, setSeries] = createSignal(initialProps.series);
    dispose = render(() => <SolidApexCharts {...initialProps} series={series()} />, container);
    await vi.waitFor(() => expect(chart.render).toHaveBeenCalledOnce());

    setSeries([{ name: 'Projects', data: [7, 8] }]);
    await vi.waitFor(() => expect(chart.updateOptions).toHaveBeenCalledOnce());
    setSeries([{ name: 'Projects', data: [9, 10] }]);
    dispose();
    dispose = undefined;
    expect(chart.destroy).not.toHaveBeenCalled();

    updating.resolve();
    await vi.waitFor(() => expect(chart.destroy).toHaveBeenCalledOnce());
    expect(chart.updateOptions).toHaveBeenCalledOnce();
  });
});

import { useEffect, useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import DetailDrawer from './DetailDrawer.jsx';

describe('DetailDrawer selection stability', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('keeps a clicked tab across parent rerenders', () => {
    let rerender;
    function Harness({ tick }) {
      return (
        <DetailDrawer storageKey="nalar-drawer:BBRI">
          {(active) => <div data-testid="panel">{active}:{tick}</div>}
        </DetailDrawer>
      );
    }
    const view = render(<Harness tick={0} />);
    rerender = view.rerender;
    fireEvent.click(screen.getByRole('tab', { name: /^Indicators$/i }));
    expect(screen.getByTestId('panel')).toHaveTextContent('indicators:0');
    expect(screen.getByRole('tab', { name: /^Indicators$/i })).toHaveAttribute('aria-selected', 'true');
    // Simulate Workbench rerender from async broker/analysis updates
    for (let i = 1; i <= 20; i += 1) {
      rerender(<Harness tick={i} />);
      expect(screen.getByRole('tab', { name: /^Indicators$/i })).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByTestId('panel')).toHaveTextContent(`indicators:${i}`);
    }
    expect(sessionStorage.getItem('nalar-drawer:BBRI')).toBe('indicators');
  });

  it('does not reset selection when an async child update arrives after click', async () => {
    function SlowChild({ active }) {
      const [n, setN] = useState(0);
      useEffect(() => {
        const id = setTimeout(() => setN(1), 0);
        return () => clearTimeout(id);
      }, [active]);
      return <div data-testid="panel">{active}:{n}</div>;
    }
    render(
      <DetailDrawer storageKey="nalar-drawer:BBRI">
        {(active) => <SlowChild active={active} />}
      </DetailDrawer>,
    );
    fireEvent.click(screen.getByRole('tab', { name: /^Broker Flow$/i }));
    expect(screen.getByRole('tab', { name: /^Broker Flow$/i })).toHaveAttribute('aria-selected', 'true');
    await screen.findByText('broker:1');
    expect(screen.getByRole('tab', { name: /^Broker Flow$/i })).toHaveAttribute('aria-selected', 'true');
    expect(sessionStorage.getItem('nalar-drawer:BBRI')).toBe('broker');
  });

  it('hydrates from sessionStorage only for a new storage key', () => {
    sessionStorage.setItem('nalar-drawer:BBRI', 'risk');
    sessionStorage.setItem('nalar-drawer:TLKM', 'methodology');
    const { rerender } = render(
      <DetailDrawer storageKey="nalar-drawer:BBRI">
        {(active) => <div data-testid="panel">{active}</div>}
      </DetailDrawer>,
    );
    expect(screen.getByTestId('panel')).toHaveTextContent('risk');
    fireEvent.click(screen.getByRole('tab', { name: /^Indicators$/i }));
    expect(screen.getByTestId('panel')).toHaveTextContent('indicators');
    rerender(
      <DetailDrawer storageKey="nalar-drawer:TLKM">
        {(active) => <div data-testid="panel">{active}</div>}
      </DetailDrawer>,
    );
    expect(screen.getByTestId('panel')).toHaveTextContent('methodology');
  });
});

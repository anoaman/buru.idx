import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import LevelsPanel from './LevelsPanel.jsx';

describe('setup level labels', () => {
  it('keeps structural resistance separate when a scenario has no confirmed target', () => {
    render(<LevelsPanel data={{ setupGeometry: {
      bestSetup: { entry: 6850, stop: 6325, target: null },
      nearestSupport: 6205, nearestResistance: 6404,
    } }} />);
    const levels = screen.getByLabelText('Setup levels');
    const target = within(levels).getByText('Target').closest('div');
    expect(target).toHaveTextContent('No confirmed target');
    expect(target).not.toHaveTextContent('6.404');
    expect(within(levels).getByText('Resistance').closest('div')).toHaveTextContent('6.404');
  });
});

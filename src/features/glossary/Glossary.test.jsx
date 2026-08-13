import { render, screen } from '@testing-library/react';
import Glossary from './Glossary.jsx';

describe('Glossary', () => {
  it('stores everyday method words without inventing live figures', () => {
    render(<Glossary />);
    expect(screen.getByRole('heading', { name: 'Glossary' })).toBeInTheDocument();
    expect(screen.getByText('Clears above')).toBeInTheDocument();
    expect(screen.getByText('Fails below')).toBeInTheDocument();
    expect(screen.getByText('Recipe fit')).toBeInTheDocument();
    expect(screen.getByText(/not a price target/i)).toBeInTheDocument();
    expect(screen.queryByText(/P\/E|12\.4/)).not.toBeInTheDocument();
  });
});

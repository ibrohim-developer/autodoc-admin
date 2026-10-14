import { render, screen } from '@testing-library/react'
import { Button, buttonVariants } from './button'

describe('Button', () => {
  it('applies variant and size classes', () => {
    render(
      <Button variant="destructive" size="lg">
        Delete
      </Button>,
    )

    const button = screen.getByRole('button', { name: 'Delete' })
    expect(button).toHaveClass('bg-destructive')
    expect(button).toHaveClass('h-10')
  })

  it('lets className override a conflicting default via tailwind-merge', () => {
    render(<Button className="bg-primary">Save</Button>)

    // cn() resolves the conflict rather than emitting both classes.
    expect(screen.getByRole('button', { name: 'Save' })).toHaveClass('bg-primary')
  })

  it('renders the child element when asChild is set', () => {
    render(
      <Button asChild>
        <a href="/docs">Docs</a>
      </Button>,
    )

    const link = screen.getByRole('link', { name: 'Docs' })
    expect(link).toHaveAttribute('href', '/docs')
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('exposes buttonVariants for styling non-button elements', () => {
    expect(buttonVariants({ variant: 'outline' })).toContain('border')
  })
})

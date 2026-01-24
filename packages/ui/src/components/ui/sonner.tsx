import { Toaster as Sonner } from 'sonner'

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="dark"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            'group toast group-[.toaster]:bg-bg-elevated group-[.toaster]:text-text-primary group-[.toaster]:border-border group-[.toaster]:shadow-lg',
          description: 'group-[.toast]:text-text-secondary',
          actionButton:
            'group-[.toast]:bg-amber-500 group-[.toast]:text-bg-deep',
          cancelButton:
            'group-[.toast]:bg-bg-surface group-[.toast]:text-text-secondary',
          success:
            'group-[.toaster]:border-green-500/50',
          error:
            'group-[.toaster]:border-destructive/50',
        },
      }}
      {...props}
    />
  )
}

export { Toaster }

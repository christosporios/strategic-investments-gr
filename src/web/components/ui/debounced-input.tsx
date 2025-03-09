import React, { useState, useEffect } from "react"
import { Input } from "./input"

interface DebouncedInputProps
    extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange"> {
    value: string
    onChange: (value: string) => void
    debounce?: number
}

export function DebouncedInput({
    value: initialValue,
    onChange,
    debounce = 500,
    ...props
}: DebouncedInputProps) {
    const [value, setValue] = useState(initialValue)

    useEffect(() => {
        setValue(initialValue)
    }, [initialValue])

    useEffect(() => {
        const timeout = setTimeout(() => {
            if (value !== initialValue) {
                onChange(value)
            }
        }, debounce)

        return () => clearTimeout(timeout)
    }, [value, initialValue, debounce, onChange])

    return (
        <Input
            {...props}
            value={value}
            onChange={(e) => setValue(e.target.value)}
        />
    )
} 
import React, { useState, useRef, useEffect } from "react";

interface AnnotationPopoverProps {
	initialComment?: string;
	onSave: (comment: string) => void;
	onClose: () => void;
	position: { x: number; y: number };
}

export default function AnnotationPopover({
	initialComment = "",
	onSave,
	onClose,
	position,
}: AnnotationPopoverProps) {
	const [comment, setComment] = useState(initialComment);
	const inputRef = useRef<HTMLTextAreaElement>(null);
	const popoverRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		inputRef.current?.focus();

		const handleClickOutside = (event: Event) => {
			if (
				popoverRef.current &&
				!popoverRef.current.contains(event.target as Node)
			) {
				onClose();
			}
		};

		document.addEventListener("mousedown", handleClickOutside);
		return () =>
			document.removeEventListener("mousedown", handleClickOutside);
	}, [onClose]);

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		onSave(comment);
	};

	return (
		<div
			ref={popoverRef}
			className="fixed z-50 w-64 rounded-lg border border-gray-200 bg-white p-4 shadow-lg"
			style={{
				left: `${position.x}px`,
				top: `${position.y}px`,
				transform: "translate(-50%, -100%) translateY(-8px)",
			}}
		>
			<form onSubmit={handleSubmit} className="space-y-4">
				<textarea
					ref={inputRef}
					value={comment}
					onChange={(e) => setComment(e.target.value)}
					className="w-full rounded-md border border-gray-300 p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
					rows={3}
					placeholder="Add your annotation..."
				/>
				<div className="flex justify-end space-x-2">
					<button
						type="button"
						onClick={onClose}
						className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800"
					>
						Cancel
					</button>
					<button
						type="submit"
						className="rounded bg-blue-500 px-3 py-1 text-sm text-white hover:bg-blue-600"
					>
						Save
					</button>
				</div>
			</form>
		</div>
	);
}

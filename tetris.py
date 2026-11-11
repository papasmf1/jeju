import random
import tkinter as tk


CELL_SIZE = 30
BOARD_WIDTH = 10
BOARD_HEIGHT = 20
BOARD_PIXEL_WIDTH = CELL_SIZE * BOARD_WIDTH
BOARD_PIXEL_HEIGHT = CELL_SIZE * BOARD_HEIGHT

PIECES = {
    "I": ((1, 1, 1, 1),),
    "O": ((1, 1), (1, 1)),
    "T": ((0, 1, 0), (1, 1, 1)),
    "S": ((0, 1, 1), (1, 1, 0)),
    "Z": ((1, 1, 0), (0, 1, 1)),
    "J": ((1, 0, 0), (1, 1, 1)),
    "L": ((0, 0, 1), (1, 1, 1)),
}

COLORS = {
    "I": "#35c9d0",
    "O": "#f2c94c",
    "T": "#a979e8",
    "S": "#65c466",
    "Z": "#e45d62",
    "J": "#5686e8",
    "L": "#ed944e",
}


class Tetris:
    def __init__(self, root):
        self.root = root
        self.root.title("테트리스")
        self.root.resizable(False, False)
        self.root.configure(bg="#18212b")

        self.board_canvas = tk.Canvas(
            root,
            width=BOARD_PIXEL_WIDTH,
            height=BOARD_PIXEL_HEIGHT,
            bg="#101820",
            highlightthickness=2,
            highlightbackground="#425466",
        )
        self.board_canvas.grid(row=0, column=0, padx=(16, 12), pady=16)

        panel = tk.Frame(root, bg="#18212b", width=170)
        panel.grid(row=0, column=1, padx=(0, 16), pady=16, sticky="n")
        panel.grid_propagate(False)

        self.score_var = tk.StringVar()
        self.lines_var = tk.StringVar()
        self.level_var = tk.StringVar()
        self.status_var = tk.StringVar()

        self._make_label(panel, "점수", 0)
        self._make_value(panel, self.score_var, 1)
        self._make_label(panel, "지운 줄", 2)
        self._make_value(panel, self.lines_var, 3)
        self._make_label(panel, "레벨", 4)
        self._make_value(panel, self.level_var, 5)
        self._make_label(panel, "다음 블록", 6)

        self.preview_canvas = tk.Canvas(
            panel,
            width=120,
            height=100,
            bg="#101820",
            highlightthickness=1,
            highlightbackground="#425466",
        )
        self.preview_canvas.grid(row=7, column=0, sticky="w", pady=(6, 18))

        self.status_label = tk.Label(
            panel,
            textvariable=self.status_var,
            bg="#18212b",
            fg="#f2c94c",
            font=("Malgun Gothic", 11, "bold"),
            justify="left",
            wraplength=155,
        )
        self.status_label.grid(row=8, column=0, sticky="w", pady=(0, 12))

        self.restart_button = tk.Button(
            panel,
            text="새 게임",
            command=self.restart,
            bg="#35a7a0",
            fg="white",
            activebackground="#27877f",
            activeforeground="white",
            relief="flat",
            padx=14,
            pady=6,
            font=("Malgun Gothic", 10, "bold"),
        )
        self.restart_button.grid(row=9, column=0, sticky="w", pady=(0, 16))

        controls = "← → 이동\n↓ 빠르게 내리기\n↑ 회전\nSpace 즉시 내리기\nP 일시정지"
        tk.Label(
            panel,
            text=controls,
            bg="#18212b",
            fg="#b8c5d1",
            justify="left",
            font=("Malgun Gothic", 9),
        ).grid(row=10, column=0, sticky="w")

        self.root.bind_all("<Left>", lambda event: self.move( -1, 0))
        self.root.bind_all("<Right>", lambda event: self.move(1, 0))
        self.root.bind_all("<Down>", self.soft_drop)
        self.root.bind_all("<Up>", lambda event: self.rotate())
        self.root.bind_all("<space>", self.hard_drop)
        self.root.bind_all("<p>", lambda event: self.toggle_pause())
        self.root.bind_all("<P>", lambda event: self.toggle_pause())
        self.root.bind_all("<r>", lambda event: self.restart())
        self.root.bind_all("<R>", lambda event: self.restart())

        self.restart()

    @staticmethod
    def _make_label(parent, text, row):
        tk.Label(
            parent,
            text=text,
            bg="#18212b",
            fg="#8fa2b3",
            font=("Malgun Gothic", 9),
        ).grid(row=row, column=0, sticky="w", pady=(10 if row else 0, 0))

    @staticmethod
    def _make_value(parent, variable, row):
        tk.Label(
            parent,
            textvariable=variable,
            bg="#18212b",
            fg="#f4f7fa",
            font=("Malgun Gothic", 18, "bold"),
        ).grid(row=row, column=0, sticky="w")

    def restart(self):
        if getattr(self, "timer_id", None) is not None:
            self.root.after_cancel(self.timer_id)
        self.timer_id = None
        self.board = [[None for _ in range(BOARD_WIDTH)] for _ in range(BOARD_HEIGHT)]
        self.score = 0
        self.lines = 0
        self.level = 1
        self.paused = False
        self.game_over = False
        self.next_kind = random.choice(tuple(PIECES))
        self.spawn_piece()
        self.update_status()
        self.update_display()
        self.schedule_tick()

    def spawn_piece(self):
        self.current_kind = self.next_kind
        self.current_shape = [list(row) for row in PIECES[self.current_kind]]
        self.current_x = (BOARD_WIDTH - len(self.current_shape[0])) // 2
        self.current_y = 0
        self.next_kind = random.choice(tuple(PIECES))
        if not self.valid_position(self.current_shape, self.current_x, self.current_y):
            self.game_over = True
            self.timer_id = None
        self.draw_preview()

    def valid_position(self, shape, x, y):
        for row_index, row in enumerate(shape):
            for column_index, cell in enumerate(row):
                if not cell:
                    continue
                board_x = x + column_index
                board_y = y + row_index
                if board_x < 0 or board_x >= BOARD_WIDTH or board_y >= BOARD_HEIGHT:
                    return False
                if board_y >= 0 and self.board[board_y][board_x] is not None:
                    return False
        return True

    def move(self, dx, dy):
        if self.paused or self.game_over:
            return
        if self.valid_position(self.current_shape, self.current_x + dx, self.current_y + dy):
            self.current_x += dx
            self.current_y += dy
            self.update_display()
        elif dy > 0:
            self.lock_piece()

    def rotate(self):
        if self.paused or self.game_over:
            return
        rotated = [list(row) for row in zip(*self.current_shape[::-1])]
        for offset in (0, -1, 1, -2, 2):
            if self.valid_position(rotated, self.current_x + offset, self.current_y):
                self.current_shape = rotated
                self.current_x += offset
                self.update_display()
                return

    def soft_drop(self, _event=None):
        if self.paused or self.game_over:
            return
        if self.valid_position(self.current_shape, self.current_x, self.current_y + 1):
            self.current_y += 1
            self.score += 1
            self.update_display()
            self.update_status()
        else:
            self.lock_piece()

    def hard_drop(self, _event=None):
        if self.paused or self.game_over:
            return
        distance = 0
        while self.valid_position(self.current_shape, self.current_x, self.current_y + 1):
            self.current_y += 1
            distance += 1
        self.score += distance * 2
        self.lock_piece()

    def lock_piece(self):
        if self.timer_id is not None:
            self.root.after_cancel(self.timer_id)
            self.timer_id = None

        color = COLORS[self.current_kind]
        for row_index, row in enumerate(self.current_shape):
            for column_index, cell in enumerate(row):
                if cell:
                    board_y = self.current_y + row_index
                    board_x = self.current_x + column_index
                    if board_y >= 0:
                        self.board[board_y][board_x] = color

        self.clear_lines()
        self.spawn_piece()
        self.update_status()
        self.update_display()
        if not self.game_over:
            self.schedule_tick()

    def clear_lines(self):
        remaining_rows = [row for row in self.board if any(cell is None for cell in row)]
        cleared = BOARD_HEIGHT - len(remaining_rows)
        if cleared:
            self.board = [[None for _ in range(BOARD_WIDTH)] for _ in range(cleared)] + remaining_rows
            self.lines += cleared
            self.score += (0, 100, 300, 500, 800)[cleared] * self.level
            self.level = self.lines // 10 + 1

    def schedule_tick(self):
        if self.paused or self.game_over:
            return
        delay = max(90, 650 - (self.level - 1) * 55)
        self.timer_id = self.root.after(delay, self.tick)

    def tick(self):
        self.timer_id = None
        if self.paused or self.game_over:
            return
        self.move(0, 1)
        if not self.game_over:
            self.schedule_tick()

    def toggle_pause(self):
        if self.game_over:
            return
        self.paused = not self.paused
        if self.paused:
            if self.timer_id is not None:
                self.root.after_cancel(self.timer_id)
                self.timer_id = None
        else:
            self.schedule_tick()
        self.update_status()
        self.update_display()

    def update_status(self):
        if self.game_over:
            self.status_var.set("게임 오버\nR 또는 새 게임으로 다시 시작")
        elif self.paused:
            self.status_var.set("일시정지\nP를 눌러 계속")
        else:
            self.status_var.set("")
        self.score_var.set(f"{self.score:,}")
        self.lines_var.set(str(self.lines))
        self.level_var.set(str(self.level))

    def draw_preview(self):
        self.preview_canvas.delete("all")
        shape = PIECES[self.next_kind]
        cell_size = 22
        width = len(shape[0]) * cell_size
        height = len(shape) * cell_size
        start_x = (120 - width) // 2
        start_y = (100 - height) // 2
        for row_index, row in enumerate(shape):
            for column_index, cell in enumerate(row):
                if cell:
                    x1 = start_x + column_index * cell_size
                    y1 = start_y + row_index * cell_size
                    self.preview_canvas.create_rectangle(
                        x1 + 1,
                        y1 + 1,
                        x1 + cell_size - 1,
                        y1 + cell_size - 1,
                        fill=COLORS[self.next_kind],
                        outline="#101820",
                    )

    def update_display(self):
        canvas = self.board_canvas
        canvas.delete("all")

        for row_index, row in enumerate(self.board):
            for column_index, color in enumerate(row):
                if color:
                    self.draw_cell(column_index, row_index, color)

        if not self.game_over:
            for row_index, row in enumerate(self.current_shape):
                for column_index, cell in enumerate(row):
                    if cell:
                        self.draw_cell(
                            self.current_x + column_index,
                            self.current_y + row_index,
                            COLORS[self.current_kind],
                        )

        for column_index in range(BOARD_WIDTH + 1):
            x = column_index * CELL_SIZE
            canvas.create_line(x, 0, x, BOARD_PIXEL_HEIGHT, fill="#24323e")
        for row_index in range(BOARD_HEIGHT + 1):
            y = row_index * CELL_SIZE
            canvas.create_line(0, y, BOARD_PIXEL_WIDTH, y, fill="#24323e")

        if self.paused or self.game_over:
            message = "일시정지" if self.paused else "게임 오버"
            canvas.create_rectangle(
                28,
                BOARD_PIXEL_HEIGHT // 2 - 38,
                BOARD_PIXEL_WIDTH - 28,
                BOARD_PIXEL_HEIGHT // 2 + 38,
                fill="#18212b",
                outline="#f2c94c",
                width=2,
            )
            canvas.create_text(
                BOARD_PIXEL_WIDTH // 2,
                BOARD_PIXEL_HEIGHT // 2,
                text=message,
                fill="#f4f7fa",
                font=("Malgun Gothic", 20, "bold"),
            )

    def draw_cell(self, column, row, color):
        x1 = column * CELL_SIZE
        y1 = row * CELL_SIZE
        self.board_canvas.create_rectangle(
            x1 + 1,
            y1 + 1,
            x1 + CELL_SIZE - 1,
            y1 + CELL_SIZE - 1,
            fill=color,
            outline="#101820",
            width=2,
        )


def main():
    root = tk.Tk()
    Tetris(root)
    root.mainloop()


if __name__ == "__main__":
    main()

import random
from collections import deque

import pygame


class Snake:
    def __init__(self, body, direction, color, head_color):
        self.body = body
        self.direction = direction
        self.color = color
        self.head_color = head_color
        self.score = 0

    def next_head(self):
        return (
            self.body[0][0] + self.direction[0],
            self.body[0][1] + self.direction[1],
        )


class SnakeGame:
    WIDTH = 800
    HEIGHT = 600
    CELL_SIZE = 20
    FPS = 10
    FOOD_COUNT = 5

    BACKGROUND = (24, 28, 36)
    PLAYER_COLOR = (75, 200, 105)
    PLAYER_HEAD = (130, 235, 145)
    COMPUTER_COLOR = (75, 135, 235)
    COMPUTER_HEAD = (140, 190, 255)
    FOOD_COLOR = (240, 85, 85)
    TEXT_COLOR = (245, 245, 245)

    def __init__(self):
        pygame.init()
        self.screen = pygame.display.set_mode((self.WIDTH, self.HEIGHT))
        pygame.display.set_caption("Snake Game")
        self.clock = pygame.time.Clock()
        self.font = pygame.font.Font(None, 36)
        self.large_font = pygame.font.Font(None, 64)
        self.reset()

    def reset(self):
        row = self.HEIGHT // self.CELL_SIZE // 2
        self.player = Snake(
            [(10, row), (9, row), (8, row)],
            (1, 0), self.PLAYER_COLOR, self.PLAYER_HEAD,
        )
        self.computer = Snake(
            [(29, row), (30, row), (31, row)],
            (-1, 0), self.COMPUTER_COLOR, self.COMPUTER_HEAD,
        )
        self.game_over = False
        self.result = ""
        self.food = set()
        self.replenish_food()

    def replenish_food(self):
        occupied = set(self.player.body) | set(self.computer.body) | self.food
        empty_cells = [
            (x, y)
            for y in range(self.HEIGHT // self.CELL_SIZE)
            for x in range(self.WIDTH // self.CELL_SIZE)
            if (x, y) not in occupied
        ]
        count = min(self.FOOD_COUNT - len(self.food), len(empty_cells))
        self.food.update(random.sample(empty_cells, count))

    def handle_events(self):
        directions = {
            pygame.K_UP: (0, -1),
            pygame.K_w: (0, -1),
            pygame.K_DOWN: (0, 1),
            pygame.K_s: (0, 1),
            pygame.K_LEFT: (-1, 0),
            pygame.K_a: (-1, 0),
            pygame.K_RIGHT: (1, 0),
            pygame.K_d: (1, 0),
        }
        direction_changed = False
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                return False
            if event.type != pygame.KEYDOWN:
                continue
            if event.key == pygame.K_ESCAPE:
                return False
            if self.game_over and event.key == pygame.K_r:
                self.reset()
                direction_changed = True
            elif not self.game_over and not direction_changed and event.key in directions:
                new_direction = directions[event.key]
                if new_direction != (-self.player.direction[0], -self.player.direction[1]):
                    self.player.direction = new_direction
                    direction_changed = True
        return True

    def inside_board(self, cell):
        return (
            0 <= cell[0] < self.WIDTH // self.CELL_SIZE
            and 0 <= cell[1] < self.HEIGHT // self.CELL_SIZE
        )

    def choose_computer_direction(self):
        directions = [(0, -1), (0, 1), (-1, 0), (1, 0)]
        reverse = (-self.computer.direction[0], -self.computer.direction[1])
        player_head = self.player.next_head()
        player_eats = player_head in self.food
        occupied = set(self.player.body if player_eats else self.player.body[:-1])
        occupied.update(self.computer.body[:-1])
        occupied.add(player_head)
        start = self.computer.body[0]
        queue = deque()
        visited = {start}
        safe_directions = []

        for direction in directions:
            if direction == reverse:
                continue
            cell = (start[0] + direction[0], start[1] + direction[1])
            if self.inside_board(cell) and cell not in occupied:
                safe_directions.append(direction)
                queue.append((cell, direction))
                visited.add(cell)

        while queue:
            cell, first_direction = queue.popleft()
            if cell in self.food:
                return first_direction
            for dx, dy in directions:
                next_cell = (cell[0] + dx, cell[1] + dy)
                if (
                    self.inside_board(next_cell)
                    and next_cell not in occupied
                    and next_cell not in visited
                ):
                    visited.add(next_cell)
                    queue.append((next_cell, first_direction))

        return safe_directions[0] if safe_directions else self.computer.direction

    def update(self):
        if self.game_over:
            return

        self.computer.direction = self.choose_computer_direction()
        snakes = (self.player, self.computer)
        heads = [snake.next_head() for snake in snakes]
        eating = [head in self.food for head in heads]
        bodies = [
            snake.body if grows else snake.body[:-1]
            for snake, grows in zip(snakes, eating)
        ]
        collisions = [
            not self.inside_board(head)
            or head in bodies[0]
            or head in bodies[1]
            or heads[0] == heads[1]
            for head in heads
        ]
        if any(collisions):
            self.game_over = True
            if all(collisions):
                self.result = "Draw!"
            elif collisions[0]:
                self.result = "Computer Wins!"
            else:
                self.result = "You Win!"
            return

        for snake, head, grows in zip(snakes, heads, eating):
            snake.body.insert(0, head)
            if grows:
                snake.score += 1
            else:
                snake.body.pop()

        if any(eating):
            self.food.difference_update(head for head, grows in zip(heads, eating) if grows)
            self.replenish_food()
            if not self.food:
                self.game_over = True
                if self.player.score == self.computer.score:
                    self.result = "Draw!"
                elif self.player.score > self.computer.score:
                    self.result = "You Win!"
                else:
                    self.result = "Computer Wins!"

    def draw(self):
        self.screen.fill(self.BACKGROUND)
        for cell in self.food:
            self.draw_cell(cell, self.FOOD_COLOR)
        for snake in (self.player, self.computer):
            for index, cell in enumerate(snake.body):
                self.draw_cell(cell, snake.head_color if index == 0 else snake.color)

        player_text = self.font.render(f"You: {self.player.score}", True, self.PLAYER_HEAD)
        computer_text = self.font.render(
            f"Computer: {self.computer.score}", True, self.COMPUTER_HEAD
        )
        self.screen.blit(player_text, (10, 10))
        self.screen.blit(computer_text, computer_text.get_rect(topright=(self.WIDTH - 10, 10)))

        if self.game_over:
            title_text = self.large_font.render(self.result, True, self.TEXT_COLOR)
            help_text = self.font.render("Press R to restart or Esc to quit", True, self.TEXT_COLOR)
            self.screen.blit(title_text, title_text.get_rect(center=(self.WIDTH // 2, self.HEIGHT // 2 - 20)))
            self.screen.blit(help_text, help_text.get_rect(center=(self.WIDTH // 2, self.HEIGHT // 2 + 25)))

        pygame.display.flip()

    def draw_cell(self, cell, color):
        rect = pygame.Rect(
            cell[0] * self.CELL_SIZE,
            cell[1] * self.CELL_SIZE,
            self.CELL_SIZE,
            self.CELL_SIZE,
        )
        pygame.draw.rect(self.screen, color, rect.inflate(-2, -2))

    def run(self):
        running = True
        try:
            while running:
                running = self.handle_events()
                if running:
                    self.update()
                    self.draw()
                    self.clock.tick(self.FPS)
        finally:
            pygame.quit()


if __name__ == "__main__":
    SnakeGame().run()

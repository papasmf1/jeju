# 반복구문.py 

value = 5 
while value > 0:
    print(value)
    value -= 1 

print("---for in루프---")
colors = ["red", "blue", "green"]
for item in colors:
    print(item)

d = {"apple":100, "kiwi":200}
for k, v in d.items():
    print(f"{k}, {v}")

print("---range()함수---")
for i in range(5):
    print(i)

for i in range(1,11):
    print(i)

print("---구구단출력---")
for x in range(2,10):
    print("---{0}단---".format(x))
    for y in range(1,10):
        print("{0} * {1} = {2}".format(x,y,x*y))


print("---구구단출력---")
for x in range(2,10):
    print(f"---{x}단---")
    for y in range(1,10):
        print(f"{x} * {y} = {x*y}")


print("---break구문---")
lst = [1,2,3,4,5,6,7,8,9,10]
for i in lst:
    if i > 5:
        break 
    print(i)

print("---continue구문---")
lst = [1,2,3,4,5,6,7,8,9,10]
for i in lst:
    #선택한 블럭만 주석처리: ctrl + / 
    if i == 5:
        continue
    print(i)


print("---리스트 컴프리헨션---")
lst = list(range(1,11))
print( [i**2 for i in lst if i>5] )
tp = ("apple", "kiwi")
print( [len(i) for i in tp] )

print("---필터링 함수---")
def getBiggerThan20(x):
    return x>20

lst = [10, 25, 30]
itemL = filter(getBiggerThan20, lst)
for item in itemL:
    print(item)

#년도, 날짜 
print( list(range(2000,2027)) )
print( list(range(1,32)) )


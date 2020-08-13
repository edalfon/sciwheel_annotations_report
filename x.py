import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

import pandas as pd

x = np.linspace(0, 20, 100)  # Create a list of evenly-spaced numbers over the range
plt.plot(x, np.sin(x))       # Plot the sine of each x point
plt.show()

code_values = [1, 2, 3]
value_labels = ["Natural", "Violenta", "En Estudio"]

list_labels_aka_column_names =   ["code_values", "value_labels"]
list_cols_aka_actual_df_values = [ code_values ,  value_labels ]

tuples_columna_name_actual_values = zip(list_labels_aka_column_names, list_cols_aka_actual_df_values)

tuples_turned_list = list(tuples_columna_name_actual_values)

list_turned_dict = dict(tuples_turned_list)

im_a_data_frame = pd.DataFrame(list_turned_dict)


im_a_data_frame["code_values"]





